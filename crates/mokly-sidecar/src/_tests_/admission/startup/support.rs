//! Public pool calls and explicit gates keep startup interleavings deterministic.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, InternalError, Result};
use crate::host_memory::HostMemoryMock;
use crate::methods::{Call, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_claim::CallClaim;
use crate::pool_options::{Launch, PoolOptions};
use crate::wire::MethodResult;

use super::process::{self, Mode};

pub(super) const GIB: u64 = 1024 * 1024 * 1024;
pub(super) const GUARD: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Event {
    Spawn(usize, String),
    Request(usize, String),
    Kill(usize),
    Reap(usize),
}

#[derive(Default)]
pub(super) struct Journal(Mutex<Vec<Event>>);

impl Journal {
    pub(super) fn emit(&self, event: Event) {
        self.0.lock().unwrap().push(event);
    }

    pub(super) fn read(&self) -> Vec<Event> {
        self.0.lock().unwrap().clone()
    }
}

#[derive(Default)]
pub(super) struct Gate {
    state: Mutex<(bool, bool)>,
    ready: Condvar,
}

impl Gate {
    pub(super) fn hold(&self) {
        let mut state = self.state.lock().unwrap();
        state.0 = true;
        self.ready.notify_all();
        while !state.1 {
            state = self.ready.wait(state).unwrap();
        }
    }

    pub(super) fn entered(&self) {
        let state = self.state.lock().unwrap();
        let (state, _) = self
            .ready
            .wait_timeout_while(state, GUARD, |state| !state.0)
            .unwrap();
        assert!(state.0, "the held operation must enter");
    }

    pub(super) fn open(&self) {
        self.state.lock().unwrap().1 = true;
        self.ready.notify_all();
    }
}

pub(super) struct Harness {
    pub(super) pool: Arc<Pool>,
    pub(super) host: Arc<AtomicU64>,
    pub(super) events: Arc<Journal>,
}

impl Harness {
    pub(super) fn new(size: usize, modes: &[Mode], hook: Arc<dyn Fn(Event) + Send + Sync>) -> Self {
        let host = Arc::new(AtomicU64::new(3 * GIB));
        let reading = host.clone();
        let events = Arc::new(Journal::default());
        let factory = process::factory(modes, &events, hook);
        let pool = Pool::new(
            Arc::new(factory.clone()),
            Arc::new(factory),
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
        )
        .with_memory_admission(Arc::new(
            Unimock::new(
                HostMemoryMock::headroom_bytes
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| Some(reading.load(Ordering::SeqCst)))),
            )
            .no_verify_in_drop(),
        ));
        Self {
            pool: Arc::new(pool),
            host,
            events,
        }
    }

    pub(super) fn start(
        &self,
        root: &str,
        context: &str,
        claim: Option<CallClaim>,
    ) -> JoinHandle<Result<MethodResult>> {
        let pool = self.pool.clone();
        let call = css(root, context);
        thread::spawn(move || match claim {
            Some(claim) => pool.request_claimed(call, &claim),
            None => pool.request(call),
        })
    }
}

pub(super) fn css(root: &str, context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        context: context.into(),
        source_root: root.into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "a.css".into(),
        text: String::new(),
    })
}

pub(super) fn text(result: Result<MethodResult>) -> String {
    let MethodResult::Css(result) = result.unwrap() else {
        panic!()
    };
    result.text
}

pub(super) fn unavailable(result: Result<MethodResult>) {
    assert!(matches!(result, Err(Error::Unavailable { part }) if part == "injected"));
}

pub(super) fn internal_failure(result: Result<MethodResult>) {
    assert!(
        matches!(result, Err(Error::Internal(InternalError::Io { source })) if source.kind() == std::io::ErrorKind::Other && source.to_string() == "injected")
    );
}
