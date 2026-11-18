//! Gated worker requests and mutable injected host and resident memory.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex, mpsc};
use std::thread::{self, JoinHandle};

use unimock::{MockFn, Unimock, matching};

use crate::host_memory::HostMemoryMock;
use crate::methods::{Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_claim::CallClaim;
use crate::pool_options::{Launch, PoolOptions};
use crate::results::Css;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, WorkerMock};

type Gate = Arc<Mutex<mpsc::Receiver<()>>>;
type Gates = Arc<Mutex<BTreeMap<usize, Gate>>>;

pub(super) const GIB: u64 = 1024 * 1024 * 1024;

pub(super) struct Harness {
    pub(super) pool: Arc<Pool>,
    pub(super) host: Arc<AtomicU64>,
    pub(super) rss: Arc<AtomicU64>,
    pub(super) starts: Arc<AtomicUsize>,
    pub(super) samples: Arc<AtomicUsize>,
    pub(super) events: mpsc::Receiver<usize>,
    startup: Arc<(Mutex<bool>, Condvar)>,
    releases: BTreeMap<usize, mpsc::Sender<()>>,
    gates: Gates,
}

impl Harness {
    pub(super) fn new(size: usize, host: Option<u64>, guarded: bool) -> Self {
        let host = Arc::new(AtomicU64::new(host.unwrap_or(u64::MAX)));
        let rss = Arc::new(AtomicU64::new(0));
        let starts = Arc::new(AtomicUsize::new(0));
        let samples = Arc::new(AtomicUsize::new(0));
        let gates: Gates = Arc::default();
        let startup = Arc::new((Mutex::new(true), Condvar::new()));
        let (entered, events) = mpsc::channel();
        let factory = Unimock::new(FactoryMock::spawn.each_call(matching!(_)).answers_arc(
            Arc::new({
                let gates = gates.clone();
                let rss = rss.clone();
                let starts = starts.clone();
                let startup = startup.clone();
                move |_, _| {
                    starts.fetch_add(1, Ordering::SeqCst);
                    {
                        let mut ready = startup.0.lock().unwrap();
                        while !*ready {
                            ready = startup.1.wait(ready).unwrap();
                        }
                    }
                    let resident = rss.clone();
                    let worker = Unimock::new((
                        WorkerMock::handshake
                            .each_call(matching!(_))
                            .answers(&|_, _| Ok(())),
                        WorkerMock::request
                            .each_call(matching!(_, _))
                            .answers_arc(Arc::new({
                                let gates = gates.clone();
                                let entered = entered.clone();
                                move |_, request, _| {
                                    let Call::ProcessCss(params) = &request.call else {
                                        panic!()
                                    };
                                    let index: usize = params.text.parse().unwrap();
                                    let gate = gates.lock().unwrap()[&index].clone();
                                    entered.send(index).unwrap();
                                    gate.lock().unwrap().recv().unwrap();
                                    Ok(MethodResult::Css(Css {
                                        read_evidence: Default::default(),
                                        unmapped_dependency_directories: None,
                                        text: index.to_string(),
                                        dependencies: vec![],
                                    }))
                                }
                            })),
                        WorkerMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(0)),
                        ControlMock::resident_bytes
                            .each_call(matching!())
                            .answers_arc(Arc::new(move |_| {
                                match resident.load(Ordering::SeqCst) {
                                    u64::MAX => Err(crate::error::Error::Crashed),
                                    bytes => Ok(bytes),
                                }
                            })),
                    ))
                    .no_verify_in_drop();
                    Ok(crate::workers::Spawned {
                        worker: Box::new(worker.clone()),
                        control: Arc::new(worker),
                    })
                }
            }),
        ))
        .no_verify_in_drop();
        let pool = Pool::new(
            Arc::new(factory),
            Arc::new(Unimock::new(())),
            Launch {
                capture_durability: false,
                node: "node".into(),
                entry: "sidecar.js".into(),
                repository: "/repo".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: size.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        let pool = if guarded {
            pool.with_memory_admission(Arc::new(
                Unimock::new(
                    HostMemoryMock::headroom_bytes
                        .each_call(matching!())
                        .answers_arc(Arc::new({
                            let host = host.clone();
                            let samples = samples.clone();
                            move |_| {
                                samples.fetch_add(1, Ordering::SeqCst);
                                match host.load(Ordering::SeqCst) {
                                    u64::MAX => None,
                                    bytes => Some(bytes),
                                }
                            }
                        })),
                )
                .no_verify_in_drop(),
            ))
        } else {
            pool
        };
        Self {
            pool: Arc::new(pool),
            host,
            rss,
            starts,
            samples,
            events,
            startup,
            releases: BTreeMap::new(),
            gates,
        }
    }

    pub(super) fn pause_start(&self) {
        *self.startup.0.lock().unwrap() = false;
    }

    pub(super) fn resume_start(&self) {
        *self.startup.0.lock().unwrap() = true;
        self.startup.1.notify_all();
    }

    pub(super) fn start(&mut self, index: usize) -> JoinHandle<MethodResult> {
        self.start_claimed(index, None)
    }

    pub(super) fn start_claimed(
        &mut self,
        index: usize,
        claim: Option<CallClaim>,
    ) -> JoinHandle<MethodResult> {
        let (send, receive) = mpsc::channel();
        self.releases.insert(index, send);
        self.gates
            .lock()
            .unwrap()
            .insert(index, Arc::new(Mutex::new(receive)));
        let pool = self.pool.clone();
        thread::spawn(move || {
            let call = Call::ProcessCss(ProcessCss {
                context: format!("context-{index}"),
                source_root: "/repo".into(),
                repository_roots: vec![],
                module_resolution: Default::default(),
                postcss: "postcss.mjs".into(),
                source_path: "a.css".into(),
                text: index.to_string(),
            });
            match claim {
                Some(claim) => pool.request_claimed(call, &claim),
                None => pool.request(call),
            }
            .unwrap()
        })
    }

    pub(super) fn queued(&self, count: u64) {
        let mut state = self.pool.lock();
        while state.ticket < count {
            state = self.pool.ready.wait(state).unwrap();
        }
    }

    pub(super) fn release(&self, index: usize) {
        self.releases[&index].send(()).unwrap();
    }
}
