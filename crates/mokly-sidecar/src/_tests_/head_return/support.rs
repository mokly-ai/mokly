//! Mocked process events and explicit gates avoid elapsed-time assertions.

use std::sync::{Arc, Condvar, Mutex};

use unimock::Unimock;

use super::process::{self, Fault, Mode};
use crate::bindings::Bindings;
use crate::methods::{Bundle, BundleRequest, Call, CssModules, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Event {
    Spawn(usize, String),
    Hello(usize),
    Request(usize, String),
    Kill(usize),
    Reap(usize),
    Shutdown(usize),
}

#[derive(Default)]
pub(super) struct Journal {
    events: Mutex<Vec<Event>>,
    changed: Condvar,
}

impl Journal {
    pub(super) fn emit(&self, event: Event) {
        self.events.lock().unwrap().push(event);
        self.changed.notify_all();
    }

    pub(super) fn read(&self) -> Vec<Event> {
        self.events.lock().unwrap().clone()
    }
}

#[derive(Default)]
pub(super) struct Gate {
    state: Mutex<(bool, bool)>,
    changed: Condvar,
}

impl Gate {
    pub(super) fn block(&self) {
        let mut state = self.state.lock().unwrap();
        state.0 = true;
        self.changed.notify_all();
        while !state.1 {
            state = self.changed.wait(state).unwrap();
        }
    }

    pub(super) fn entered(&self) {
        let mut state = self.state.lock().unwrap();
        while !state.0 {
            state = self.changed.wait(state).unwrap();
        }
    }

    pub(super) fn open(&self) {
        self.state.lock().unwrap().1 = true;
        self.changed.notify_all();
    }
}

pub(super) struct Harness {
    pub(super) pool: Arc<Pool>,
    pub(super) events: Arc<Journal>,
    _factory: Unimock,
    _workers: Vec<Unimock>,
}

impl Harness {
    pub(super) fn new(size: usize, modes: &[Mode], hook: Arc<dyn Fn(Event) + Send + Sync>) -> Self {
        Self::build(size, modes, hook, None)
    }

    pub(super) fn fault(size: usize, modes: &[Mode], event: Event) -> Self {
        Self::fault_with_hook(size, modes, event, Arc::new(|_| {}))
    }

    pub(super) fn fault_with_hook(
        size: usize,
        modes: &[Mode],
        event: Event,
        hook: Arc<dyn Fn(Event) + Send + Sync>,
    ) -> Self {
        Self::build(
            size,
            modes,
            hook,
            Some(Arc::new(Fault {
                event,
                used: false.into(),
            })),
        )
    }

    fn build(
        size: usize,
        modes: &[Mode],
        hook: Arc<dyn Fn(Event) + Send + Sync>,
        fault: Option<Arc<Fault>>,
    ) -> Self {
        let events = Arc::new(Journal::default());
        let (workers, factory) = process::processes(modes, &events, hook, fault);
        Self {
            pool: Arc::new(Pool::new(
                Arc::new(factory.clone()),
                Arc::new(factory.clone()),
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
            )),
            events,
            _factory: factory,
            _workers: workers,
        }
    }

    pub(super) fn plain(size: usize, modes: &[Mode]) -> Self {
        Self::new(size, modes, Arc::new(|_| {}))
    }
}

pub(super) fn css(root: &str, context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context: context.into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

pub(super) fn bundle(root: &str, generation: &str) -> Call {
    Call::Bundle(BundleRequest {
        preparation: None,
        plan: None,
        params: Bundle {
            source_root: root.into(),
            configuration_directory: ".".into(),
            entry_files: vec![generation.into()],
            renderer: None,
            stories_files: vec![],
            storybook_folders: Default::default(),
            repository_roots: vec![],
            module_resolution: Default::default(),
            vite: false,
            vite_inputs: None,
            evaluation: None,
        },
        capture: None,
    })
}

pub(super) fn install(pool: &dyn SidecarPool, generation: &str) {
    pool.request(Call::CssModules(CssModules {
        generation: generation.into(),
        named_exports: None,
        class_maps: Default::default(),
    }))
    .unwrap();
    pool.request(Call::Bindings(Bindings {
        generation: generation.into(),
        entries: Default::default(),
    }))
    .unwrap();
}

pub(super) fn render(generation: &str) -> Call {
    Call::RenderPage(RenderPage {
        generation: generation.into(),
        handle: "page#default".into(),
    })
}

pub(super) fn waiting(pool: &Pool, count: usize) {
    let mut state = pool.lock();
    while state.waiting.len() != count {
        state = pool.ready.wait(state).unwrap();
    }
}
