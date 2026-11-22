//! Synchronization points for deterministic early-render lifetime tests.

use std::sync::atomic::Ordering;

use super::{Flights, State};

impl Flights {
    pub(crate) fn wait_for_reader(&self, route: &str) -> bool {
        let flight = &self.entries[route];
        let mut state = flight.state.lock().unwrap();
        while !matches!(*state, State::Running { reader: true } | State::Taken) {
            state = flight.changed.wait(state).unwrap();
        }
        matches!(*state, State::Running { reader: true })
    }

    pub(crate) fn wait_for_completion(&self, route: &str) {
        let flight = &self.entries[route];
        let mut state = flight.state.lock().unwrap();
        while !matches!(*state, State::Ready(_) | State::Taken) {
            state = flight.changed.wait(state).unwrap();
        }
    }

    pub(crate) fn wait_for_stop(&self, route: &str) {
        let flight = &self.entries[route];
        let mut state = flight.state.lock().unwrap();
        while !self.stopped.load(Ordering::Acquire) {
            state = flight.changed.wait(state).unwrap();
        }
    }
}
