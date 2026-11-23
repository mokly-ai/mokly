//! Only joined readers keep a live early-render result outside the render cache.

use std::collections::BTreeMap;
use std::mem;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, Weak};

use crate::cache::Artifact;
use crate::error::{InternalError, Result};

enum State {
    Queued,
    Running { reader: bool },
    Ready(Result<Rendered>),
    Taken,
}

struct Rendered {
    cached: Weak<Artifact>,
    shared: Option<Arc<Artifact>>,
}

pub(crate) struct Flight {
    state: Mutex<State>,
    changed: Condvar,
}

pub(crate) struct Flights {
    stopped: AtomicBool,
    pub(crate) routes: Vec<String>,
    entries: BTreeMap<String, Arc<Flight>>,
}

impl Flights {
    pub(crate) fn new(routes: Vec<String>) -> Self {
        let entries = routes
            .iter()
            .map(|route| {
                (
                    route.clone(),
                    Arc::new(Flight {
                        state: Mutex::new(State::Queued),
                        changed: Condvar::new(),
                    }),
                )
            })
            .collect();
        Self {
            stopped: AtomicBool::new(false),
            routes,
            entries,
        }
    }

    pub(crate) fn claim(&self, route: &str) -> Option<Arc<Flight>> {
        if self.stopped.load(Ordering::Acquire) {
            return None;
        }
        let flight = self.entries.get(route)?.clone();
        {
            let mut state = flight
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if !matches!(*state, State::Queued) {
                return None;
            }
            *state = State::Running { reader: false };
        }
        Some(flight)
    }

    pub(crate) fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        for flight in self.entries.values() {
            let _state = flight
                .state
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            flight.changed.notify_all();
        }
    }

    pub(crate) fn read(&self, route: &str) -> Option<Result<Arc<Artifact>>> {
        let flight = self.entries.get(route)?;
        let mut state = flight
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        loop {
            match &mut *state {
                State::Queued => {
                    *state = State::Taken;
                    return None;
                }
                State::Running { reader } => {
                    *reader = true;
                    flight.changed.notify_all();
                    state = flight
                        .changed
                        .wait(state)
                        .unwrap_or_else(|error| error.into_inner());
                }
                State::Ready(_) => {
                    let State::Ready(result) = mem::replace(&mut *state, State::Taken) else {
                        return None;
                    };
                    return match result {
                        Ok(value) => value.shared.or_else(|| value.cached.upgrade()).map(Ok),
                        Err(error) => Some(Err(error)),
                    };
                }
                State::Taken => return None,
            }
        }
    }
}

impl Flight {
    pub(crate) fn failed(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if matches!(*state, State::Running { .. }) {
            *state = State::Ready(Err(InternalError::PreparationPanicked.into()));
            self.changed.notify_all();
        }
    }

    pub(crate) fn complete(&self, result: Result<Arc<Artifact>>) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let reader = matches!(*state, State::Running { reader: true });
        let result = result.map(|artifact| Rendered {
            cached: Arc::downgrade(&artifact),
            shared: reader.then_some(artifact),
        });
        *state = State::Ready(result);
        self.changed.notify_all();
    }
}

#[cfg(test)]
#[path = "_tests_/prefetch_state_support.rs"]
mod prefetch_state_support;
