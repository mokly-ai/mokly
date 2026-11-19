//! Mocked failed reaping and bounded result waits for Serve admission regressions.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use mokly_sidecar::error::{Error, Result};
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::{ClockMock, ControlMock, FactoryMock, Spawned, WorkerMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::ServePool;

use super::serve_pool_support::css;

pub(super) const HANG_GUARD: Duration = Duration::from_secs(10);

pub(super) struct Pending {
    complete: mpsc::Receiver<Result<MethodResult>>,
    thread: JoinHandle<()>,
}

impl Pending {
    pub(super) fn receive(
        &self,
    ) -> std::result::Result<Result<MethodResult>, mpsc::RecvTimeoutError> {
        self.complete.recv_timeout(HANG_GUARD)
    }

    pub(super) fn join(self) {
        self.thread.join().unwrap();
    }
}

pub(super) fn request(pool: Arc<dyn SidecarPool>, root: &str, index: usize) -> Pending {
    let call = css(root, index);
    let (send, complete) = mpsc::channel();
    let thread = thread::spawn(move || send.send(pool.request(call)).unwrap());
    Pending { complete, thread }
}

pub(super) fn queued(
    scheduler: &ServePool,
    active: usize,
    waiting: usize,
) -> (usize, usize, usize) {
    let state = scheduler.gate.state.lock().unwrap();
    let (state, _) = scheduler
        .gate
        .changed
        .wait_timeout_while(state, HANG_GUARD, |state| {
            state.active != active || state.waiting != waiting
        })
        .unwrap();
    (state.active, state.waiting, state.waiting_base)
}

pub(super) fn counters(scheduler: &ServePool) -> (usize, usize, usize, usize) {
    let state = scheduler.gate.state.lock().unwrap();
    (
        state.active,
        state.waiting,
        state.waiting_base,
        state.foreground,
    )
}

pub(super) struct Retirement {
    pub(super) pool: Arc<Pool>,
    pub(super) scheduler: ServePool,
    pub(super) reaping: mpsc::Receiver<()>,
    pub(super) release: mpsc::Sender<()>,
    pub(super) starts: Arc<AtomicUsize>,
}

impl Retirement {
    pub(super) fn new(size: usize) -> Self {
        let (entered, reaping) = mpsc::channel();
        let (release, released) = mpsc::channel();
        let released = Arc::new(Mutex::new(released));
        let starts = Arc::new(AtomicUsize::new(0));
        let factory = Unimock::new(FactoryMock::spawn.each_call(matching!(_)).answers_arc(
            Arc::new({
                let starts = starts.clone();
                move |_, _| {
                    let index = starts.fetch_add(1, Ordering::SeqCst);
                    let first = AtomicBool::new(true);
                    let worker = Unimock::new((
                        WorkerMock::handshake
                            .each_call(matching!(_))
                            .answers(&|_, _| Ok(())),
                        WorkerMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(0)),
                        WorkerMock::request
                            .each_call(matching!(_, _))
                            .answers_arc(Arc::new(move |_, request, _| {
                                assert!(matches!(request.call, Call::ProcessCss(_)));
                                Ok(MethodResult::Css(Css {
                                    read_evidence: Default::default(),
                                    unmapped_dependency_directories: None,
                                    text: index.to_string(),
                                    dependencies: vec![],
                                }))
                            })),
                        ControlMock::kill
                            .each_call(matching!())
                            .answers(&|_| Ok(())),
                        ControlMock::finish
                            .each_call(matching!(_))
                            .answers_arc(Arc::new({
                                let entered = entered.clone();
                                let released = released.clone();
                                move |_, _| {
                                    if index == 0 && first.swap(false, Ordering::SeqCst) {
                                        entered.send(()).unwrap();
                                        released.lock().unwrap().recv().unwrap();
                                        return Err(Error::Unavailable {
                                            part: "injected reap".into(),
                                        });
                                    }
                                    Ok(())
                                }
                            })),
                    ))
                    .no_verify_in_drop();
                    Ok(Spawned {
                        worker: Box::new(worker.clone()),
                        control: Arc::new(worker),
                    })
                }
            }),
        ))
        .no_verify_in_drop();
        let clock = Unimock::new(ClockMock::now_ms.each_call(matching!()).returns(0_u64));
        let pool = Arc::new(Pool::new(
            Arc::new(factory),
            Arc::new(clock),
            Launch {
                capture_durability: false,
                repository: "/head".into(),
                node: "node".into(),
                entry: "sidecar.js".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: size.try_into().unwrap(),
                timeout_ms: None,
            },
        ));
        pool.request(css("/base", 0)).unwrap();
        let scheduler = ServePool::new(pool.clone(), pool.clone());
        Self {
            pool,
            scheduler,
            reaping,
            release,
            starts,
        }
    }

    pub(super) fn synchronize(&self) {
        let wake = self
            .scheduler
            .gate
            .return_wake
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .clone();
        wake.synchronize();
    }
}
