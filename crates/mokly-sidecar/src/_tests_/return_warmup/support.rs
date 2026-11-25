//! Spawned processes journal each call in start order, and a hook can hold or fail one call.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::error::Result;
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::workers::{ClockMock, FactoryMock, Spawned};

use super::calls::{bindings, bundle, css, maps, render};
use super::process::{StoryFails, process};

/// The polling allowance for an expected state; it guards hangs and is not a speed contract.
const ALLOWANCE: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Event {
    Spawn(usize, String),
    Call(usize, String),
    Quiet(usize, String),
    Kill(usize),
    Reap(usize),
}

/// The hook sees each event of a process and can fail its call.
pub(super) type Hook = Arc<dyn Fn(&Event) -> Result<()> + Send + Sync>;

#[derive(Default)]
pub(super) struct Journal {
    events: Mutex<Vec<Event>>,
}

impl Journal {
    pub(super) fn emit(&self, event: Event) {
        self.events.lock().unwrap().push(event);
    }

    pub(super) fn read(&self) -> Vec<Event> {
        self.events.lock().unwrap().clone()
    }

    /// The call labels of the process that started in this position.
    pub(super) fn calls(&self, process: usize) -> Vec<String> {
        self.read()
            .into_iter()
            .filter_map(|event| match event {
                Event::Call(id, label) if id == process => Some(label),
                _ => None,
            })
            .collect()
    }

    /// The labels of the calls that asked the process to stay quiet.
    pub(super) fn quiet(&self, process: usize) -> Vec<String> {
        self.read()
            .into_iter()
            .filter_map(|event| match event {
                Event::Quiet(id, label) if id == process => Some(label),
                _ => None,
            })
            .collect()
    }

    pub(super) fn spawns(&self) -> usize {
        self.read()
            .iter()
            .filter(|event| matches!(event, Event::Spawn(_, _)))
            .count()
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

    /// Wait until the hook holds the call; a call that never starts fails the test.
    pub(super) fn entered(&self) {
        let state = self.state.lock().unwrap();
        let (state, _) = self
            .changed
            .wait_timeout_while(state, ALLOWANCE, |state| !state.0)
            .unwrap();
        assert!(state.0, "the held call never started");
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
}

impl Harness {
    /// A pool of `size` slots whose factory starts journaled processes on demand.
    pub(super) fn new(size: usize, hook: Hook) -> Self {
        Self::with_story_failures(size, hook, |_, _| false)
    }

    pub(super) fn with_story_failures(size: usize, hook: Hook, story_fails: StoryFails) -> Self {
        let events = Arc::new(Journal::default());
        let journal = events.clone();
        let started = AtomicUsize::new(0);
        let factory = Unimock::new((
            FactoryMock::spawn
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, launch| {
                    let id = started.fetch_add(1, Ordering::SeqCst);
                    let root = launch.repository.to_string_lossy().into_owned();
                    journal.emit(Event::Spawn(id, root));
                    let process = process(id, &journal, hook.clone(), story_fails);
                    Ok(Spawned {
                        worker: Box::new(process.clone()),
                        control: Arc::new(process),
                    })
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
        Self {
            pool: Arc::new(pool),
            events,
            _factory: factory,
        }
    }

    pub(super) fn plain(size: usize) -> Self {
        Self::new(size, Arc::new(|_| Ok(())))
    }

    /// Bundle a head generation, install its class maps and bindings, and render each view.
    pub(super) fn head(&self, generation: &str, views: &[String]) {
        self.pool.request(bundle(generation)).unwrap();
        self.pool.request(maps(generation)).unwrap();
        self.pool.request(bindings(generation)).unwrap();
        for view in views {
            self.pool.request(render(generation, view)).unwrap();
        }
    }

    /// Base work takes a slot, and its process moves to the base root.
    pub(super) fn base(&self) {
        self.pool.request(css("/base", "base")).unwrap();
    }

    /// Move both slots of a two-slot pool to the base root; the hook holds process 1's "hold".
    pub(super) fn two_base(&self, hold: &Gate) {
        let pool = self.pool.clone();
        let busy = thread::spawn(move || pool.request(css("/base", "hold")).unwrap());
        hold.entered();
        self.pool.request(css("/base", "second")).unwrap();
        hold.open();
        busy.join().unwrap();
    }

    /// A publication schedules the return pass, and one step returns one base process.
    pub(super) fn returned(&self) {
        self.pool.schedule_head_return();
        assert!(self.pool.maintain_head_return().unwrap());
    }

    /// Run maintenance steps until none is left, and count them.
    pub(super) fn maintain(&self) -> usize {
        let mut steps = 0;
        while self.pool.maintain_head_return().unwrap() {
            steps += 1;
        }
        steps
    }

    /// Wait until `count` requests wait in the pool queue.
    pub(super) fn waiting(&self, count: usize) {
        let state = self.pool.lock();
        let (state, _) = self
            .pool
            .ready
            .wait_timeout_while(state, ALLOWANCE, |state| state.waiting.len() != count)
            .unwrap();
        assert_eq!(state.waiting.len(), count, "requests in the pool queue");
    }
}
