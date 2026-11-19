//! Count-bounded completion ownership for the background usage window.

use std::mem;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::task::Waker;

use mokly_graph::background::Completion;
use mokly_graph::cache_lease::ByteLease;
use tokio::sync::OwnedSemaphorePermit;

use crate::background_capacity::BackgroundCapacity;
use crate::priority::Priority;

/// Completion admission shared by current and superseded generations of one Serve.
/// Original workers and sidecar claims still bound unsignalled replacement work.
pub struct Stages {
    capacity: Arc<dyn BackgroundCapacity>,
    active: Mutex<usize>,
    changed: Condvar,
}

impl Stages {
    /// Create completion admission without starting work.
    pub fn new(capacity: Arc<dyn BackgroundCapacity>) -> Arc<Self> {
        Arc::new(Self {
            capacity,
            active: Mutex::new(0),
            changed: Condvar::new(),
        })
    }

    /// Allocate the owner of one admitted view.
    pub fn view(self: &Arc<Self>, route: &str) -> Arc<Stage> {
        Arc::new(Stage {
            bound: self.clone(),
            state: Mutex::new(State::default()),
            handed: AtomicBool::new(false),
            wake: Mutex::new(None),
            queue_bytes: AtomicUsize::new(0),
            route: route.into(),
        })
    }

    fn acquire(self: &Arc<Self>) -> Place {
        let mut active = self
            .active
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while *active >= self.capacity.capacity().max(1) {
            active = self
                .changed
                .wait(active)
                .unwrap_or_else(|error| error.into_inner());
        }
        *active += 1;
        Place(self.clone())
    }
}

struct Place(Arc<Stages>);
impl Drop for Place {
    fn drop(&mut self) {
        *self
            .0
            .active
            .lock()
            .unwrap_or_else(|error| error.into_inner()) -= 1;
        self.0.changed.notify_all();
    }
}

#[derive(Default)]
struct State {
    worker: Option<OwnedSemaphorePermit>,
    priority: Option<Arc<Priority>>,
    place: Option<Place>,
    lease: Option<Box<dyn ByteLease>>,
}

/// One view keeps its dispatch ownership until a charged handoff or its end.
pub struct Stage {
    bound: Arc<Stages>,
    state: Mutex<State>,
    handed: AtomicBool,
    wake: Mutex<Option<Waker>>,
    queue_bytes: AtomicUsize,
    route: String,
}

impl Stage {
    pub(crate) fn attach(&self, permit: OwnedSemaphorePermit, priority: Arc<Priority>) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.worker = Some(permit);
        state.priority = Some(priority);
    }

    pub(crate) fn handed_off(&self) -> bool {
        self.handed.load(Ordering::SeqCst)
    }

    pub(crate) fn register(&self, wake: &Waker) {
        *self.wake.lock().unwrap_or_else(|error| error.into_inner()) = Some(wake.clone());
    }

    pub(crate) fn queue_bytes(&self, bytes: usize) {
        self.queue_bytes.store(bytes, Ordering::SeqCst);
    }

    pub(crate) fn finish(&self) {
        let (released, priority) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            (
                (state.place.take(), state.worker.take(), state.lease.take()),
                state.priority.take(),
            )
        };
        {
            let _released = released;
        }
        if let Some(priority) = priority {
            priority.changed.notify_waiters();
        }
    }
}

impl Completion for Stage {
    fn enter(&self) {
        if self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .place
            .is_some()
        {
            return;
        }
        let place = self.bound.acquire();
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .place = Some(place);
    }

    fn handoff(&self, lease: Box<dyn ByteLease>) {
        self.enter();
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if self.handed.swap(true, Ordering::SeqCst) {
                return;
            }
            state.lease = Some(lease);
            state.worker.take();
            if let Some(priority) = &state.priority {
                priority.changed.notify_waiters();
            }
        }
        if let Some(wake) = self
            .wake
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            wake.wake();
        }
    }

    fn metadata_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + mem::size_of::<Stages>()
            + self.route.capacity().saturating_mul(2)
            + self.queue_bytes.load(Ordering::SeqCst)
            + 1024
    }
}

pub(crate) struct Running(pub(crate) Arc<Stage>);
impl Drop for Running {
    fn drop(&mut self) {
        self.0.finish();
    }
}

#[cfg(test)]
#[path = "_tests_/overlap_worker_tests.rs"]
mod overlap_worker_tests;

#[cfg(test)]
#[path = "_tests_/overlap_stage_tests.rs"]
mod overlap_stage_tests;
