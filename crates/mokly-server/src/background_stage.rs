//! Count-bounded completion ownership for the background usage window.

use std::mem;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};

use mokly_graph::background::Completion;
use tokio::sync::OwnedSemaphorePermit;

use crate::background_admission::{Admission, BatchPlace};
use crate::background_capacity::BackgroundCapacity;
use crate::background_dispatch::Dispatch;
use crate::priority::Priority;

/// Completion admission shared by current and superseded generations of one Serve.
/// Original workers and sidecar claims still bound unsignalled replacement work.
pub struct Stages {
    pub(crate) batch: Arc<Admission>,
    capacity: Arc<dyn BackgroundCapacity>,
    active: Mutex<usize>,
    changed: Condvar,
    bytes: Mutex<usize>,
}

impl Stages {
    /// Create completion admission without starting work.
    pub fn new(capacity: Arc<dyn BackgroundCapacity>) -> Arc<Self> {
        Arc::new(Self {
            batch: Admission::new(capacity.clone()),
            capacity,
            active: Mutex::new(0),
            changed: Condvar::new(),
            bytes: Mutex::new(0),
        })
    }

    /// Allocate the owner of one admitted view.
    pub fn view(self: &Arc<Self>, route: &str) -> Arc<Stage> {
        self.view_dispatched(route, Dispatch::new(self.clone()))
    }

    pub(crate) fn view_dispatched(
        self: &Arc<Self>,
        route: &str,
        dispatch: Arc<Dispatch>,
    ) -> Arc<Stage> {
        let stage = Arc::new(Stage {
            bound: self.clone(),
            state: Mutex::new(State::default()),
            dispatch: dispatch.clone(),
            handed: AtomicBool::new(false),
            route: route.into(),
        });
        let _ = dispatch.stage.set(Arc::downgrade(&stage));
        stage
    }

    fn reserve(self: &Arc<Self>, charge: usize) -> Option<Charge> {
        let mut bytes = self.bytes.lock().unwrap_or_else(|error| error.into_inner());
        if charge > TRANSIENT_BYTES.saturating_sub(*bytes) {
            return None;
        }
        *bytes += charge;
        Some(Charge {
            bound: self.clone(),
            bytes: charge,
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

const TRANSIENT_BYTES: usize = 4 * 1024 * 1024;

struct Charge {
    bound: Arc<Stages>,
    bytes: usize,
}
impl Drop for Charge {
    fn drop(&mut self) {
        *self
            .bound
            .bytes
            .lock()
            .unwrap_or_else(|error| error.into_inner()) -= self.bytes;
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
    batch: Option<BatchPlace>,
    worker: Option<OwnedSemaphorePermit>,
    priority: Option<Arc<Priority>>,
    place: Option<Place>,
    charge: Option<Charge>,
}

/// One view keeps its dispatch ownership until a charged handoff or its end.
pub struct Stage {
    bound: Arc<Stages>,
    state: Mutex<State>,
    dispatch: Arc<Dispatch>,
    handed: AtomicBool,
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

    pub(crate) fn attach_batch(&self, batch: BatchPlace) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .batch = Some(batch);
    }

    /// Admit prepared-root completion while its original dispatch worker remains owned.
    pub(crate) fn enter(&self) {
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

    pub(crate) fn finish(&self) {
        let (released, priority) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            (
                (
                    state.place.take(),
                    state.worker.take(),
                    state.charge.take(),
                    state.batch.take(),
                ),
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
    fn handoff(&self, bytes: usize) {
        let charge = self.bound.reserve(bytes);
        self.enter();
        let Some(charge) = charge else {
            return;
        };
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if self.handed.swap(true, Ordering::SeqCst) {
                return;
            }
            state.charge = Some(charge);
            state.worker.take();
            state.batch.take();
            self.dispatch.handoff();
            if let Some(priority) = &state.priority {
                priority.changed.notify_waiters();
            }
        }
    }

    fn metadata_bytes(&self) -> usize {
        mem::size_of::<Self>()
            + mem::size_of::<Stages>()
            + self.route.capacity().saturating_mul(2)
            + self.dispatch.queue_bytes.load(Ordering::SeqCst)
            + mem::size_of::<Dispatch>()
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

#[cfg(test)]
#[path = "_tests_/overlap_native_tests.rs"]
mod overlap_native_tests;
