//! Seeded live processes journal each call, and a hook can hold or fail one call.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Condvar, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::compiled_fixture::compiled;
use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::pool_state::Slot;
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{
    ClockMock, ControlMock, FactoryMock, SpawnFailure, WorkerControl, WorkerMock,
};

use super::calls::{bundle, describe, maps};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Event {
    Call(usize, String),
    Kill(usize),
    Reap(usize),
    Spawn,
}

pub(super) type Hook = Arc<dyn Fn(&Event) -> Result<()> + Send + Sync>;

#[derive(Default)]
pub(super) struct Journal {
    events: Mutex<Vec<Event>>,
}

impl Journal {
    fn emit(&self, event: Event) {
        self.events.lock().unwrap().push(event);
    }

    pub(super) fn read(&self) -> Vec<Event> {
        self.events.lock().unwrap().clone()
    }

    pub(super) fn calls(&self, slot: usize) -> Vec<String> {
        self.read()
            .into_iter()
            .filter_map(|event| match event {
                Event::Call(index, label) if index == slot => Some(label),
                _ => None,
            })
            .collect()
    }
}

/// A call that the hook holds until the test opens it.
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
    _mocks: Vec<Unimock>,
}

impl Harness {
    /// Seed one idle live process for each root in a pool of `size` slots.
    pub(super) fn new(size: usize, roots: &[&str], hook: Hook) -> Self {
        let events = Arc::new(Journal::default());
        let spawns = events.clone();
        let factory = Unimock::new((
            FactoryMock::spawn
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    spawns.emit(Event::Spawn);
                    Err(SpawnFailure::NotStarted(Error::Unavailable {
                        part: "test process".into(),
                    }))
                })),
            ClockMock::now_ms.each_call(matching!()).returns(100_u64),
        ))
        .no_verify_in_drop();
        let pool = Pool::new(
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
        );
        let mut mocks = vec![factory];
        {
            let mut state = pool.lock();
            for (index, root) in roots.iter().enumerate() {
                let process = process(index, &events, hook.clone());
                let control: Arc<dyn WorkerControl> = Arc::new(process.clone());
                state.controls.insert(index, control.clone());
                state.source_roots.insert(index, (*root).into());
                state.slots.push(Some(Slot {
                    source_root: (*root).into(),
                    worker: Box::new(process.clone()),
                    control,
                    generations: BTreeMap::new(),
                    maps: BTreeSet::new(),
                    described: BTreeSet::new(),
                    bindings: BTreeMap::new(),
                    contexts: BTreeSet::new(),
                    renders: 0,
                    requests: 0,
                }));
                state.available.push_back(index);
                mocks.push(process);
            }
        }
        Self {
            pool: Arc::new(pool),
            events,
            _mocks: mocks,
        }
    }

    pub(super) fn plain(size: usize, roots: &[&str]) -> Self {
        Self::new(size, roots, Arc::new(|_| Ok(())))
    }

    /// Bundle, map, and describe one head generation through ordinary requests.
    pub(super) fn describe_head(&self, generation: &str) {
        self.pool.request(bundle(generation)).unwrap();
        self.pool.request(maps(generation)).unwrap();
        self.pool.request(describe(generation)).unwrap();
    }

    /// Run maintenance steps until none is left, and count them.
    pub(super) fn maintain(&self) -> usize {
        let mut steps = 0;
        while self.pool.maintain_head_return().unwrap() {
            steps += 1;
        }
        steps
    }

    /// Wait until the pool queue holds `count` requests or a process start was tried.
    pub(super) fn queued_or_started(&self, count: usize) {
        let mut state = self.pool.lock();
        while state.waiting.len() != count && !self.events.read().contains(&Event::Spawn) {
            state = self.pool.ready.wait(state).unwrap();
        }
    }
}

fn process(index: usize, events: &Arc<Journal>, hook: Hook) -> Unimock {
    let calls = events.clone();
    let kills = events.clone();
    let reaps = events.clone();
    let reaped = hook.clone();
    Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let label = match &request.call {
                    Call::Bundle(params) => format!("bundle {}", params.params.entry_files[0]),
                    Call::ProcessCss(params) => params.context.clone(),
                    call => call.to_string(),
                };
                let event = Event::Call(index, label);
                calls.emit(event.clone());
                hook(&event)?;
                Ok(match &request.call {
                    Call::Bundle(params) => MethodResult::Bundle(Box::new(results::Bundle {
                        plan: None,
                        generation: params.params.entry_files[0].clone(),
                        epoch: 0,
                        cache: None,
                        compiled: Arc::new(compiled(&params.params.entry_files[0])),
                        modules: vec![],
                        unmapped_dependency_directories: None,
                    })),
                    _ => MethodResult::Empty,
                })
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
        ControlMock::kill
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                kills.emit(Event::Kill(index));
                Ok(())
            })),
        ControlMock::shutdown
            .each_call(matching!())
            .answers(&|_| Ok(())),
        ControlMock::finish
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                reaps.emit(Event::Reap(index));
                reaped(&Event::Reap(index))
            })),
    ))
    .no_verify_in_drop()
}
