//! Small writer admission state, independent of pending work and publication locks.

use std::sync::{Arc, Condvar, Mutex};

use mokly_graph::write_activity::{WriteActivity, WriteLease, WriteReadiness};

pub(crate) struct Admission {
    inner: Arc<Inner>,
}

struct Inner {
    state: Mutex<State>,
    changed: Condvar,
}

struct State {
    epoch: usize,
    busy: usize,
    first: bool,
    closed: bool,
    readiness: Option<Arc<dyn WriteReadiness>>,
}

impl Admission {
    pub(crate) fn new(paused: bool) -> Self {
        Self {
            inner: Arc::new(Inner {
                state: Mutex::new(State {
                    epoch: 0,
                    busy: 0,
                    first: !paused,
                    closed: false,
                    readiness: None,
                }),
                changed: Condvar::new(),
            }),
        }
    }

    pub(crate) fn bind(&self, readiness: Arc<dyn WriteReadiness>) {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.readiness = Some(readiness);
        state.epoch += 1;
        self.inner.changed.notify_all();
    }

    pub(crate) fn resume(&self) {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.first = true;
        state.epoch += 1;
        self.inner.changed.notify_all();
    }

    pub(crate) fn notify(&self) {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.epoch += 1;
        self.inner.changed.notify_all();
    }

    pub(crate) fn close(&self) {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.closed = true;
        state.epoch += 1;
        self.inner.changed.notify_all();
    }

    pub(crate) fn status(&self) -> (usize, bool, bool) {
        let (epoch, first, closed, readiness) = {
            let state = self
                .inner
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            (
                state.epoch,
                state.first,
                state.closed,
                state.readiness.clone(),
            )
        };
        let ready = !closed && first && readiness.is_none_or(|readiness| readiness.ready());
        let state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        (
            epoch,
            state.closed,
            ready && !state.closed && state.first && state.busy == 0 && state.epoch == epoch,
        )
    }

    pub(crate) fn wait(&self, epoch: usize) {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while !state.closed && state.epoch == epoch {
            state = self
                .inner
                .changed
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }

    pub(crate) fn ready(&self) -> bool {
        loop {
            let (epoch, closed, ready) = self.status();
            if closed {
                return false;
            }
            if ready {
                return true;
            }
            self.wait(epoch);
        }
    }
}

impl WriteActivity for Admission {
    fn enter(&self) -> Box<dyn WriteLease> {
        let mut state = self
            .inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.busy += 1;
        state.epoch += 1;
        self.inner.changed.notify_all();
        Box::new(Lease(self.inner.clone()))
    }
}

struct Lease(Arc<Inner>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        let mut state = self
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.busy -= 1;
        state.epoch += 1;
        self.0.changed.notify_all();
    }
}

#[cfg(test)]
#[path = "_tests_/render_admission_tests.rs"]
mod render_admission_tests;
