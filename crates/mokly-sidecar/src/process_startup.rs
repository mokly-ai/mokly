//! Partial startup shares one lazy retirement span until all ownership cleanup finishes.

use std::sync::{Mutex, MutexGuard};

use tracing::Span;

use crate::pool_timing::Reason;

#[derive(Default)]
pub(super) struct StartupTiming(Mutex<State>);

#[derive(Default)]
struct State {
    span: Option<Span>,
    failed: bool,
    handed_off: bool,
}

impl StartupTiming {
    fn state(&self) -> MutexGuard<'_, State> {
        match self.0.lock() {
            Ok(state) => state,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    pub(super) fn stop(&self) -> Span {
        let mut state = self.state();
        if state.handed_off {
            return Span::none();
        }
        state
            .span
            .get_or_insert_with(|| Reason::Retry.stop())
            .clone()
    }

    pub(super) fn active(&self) -> Span {
        self.state().span.clone().unwrap_or_else(Span::none)
    }

    pub(super) fn observe(&self, success: bool) {
        let mut state = self.state();
        if state.span.is_some() {
            state.failed |= !success;
        }
    }

    pub(super) fn hand_off(&self) {
        self.state().handed_off = true;
    }
}

impl Drop for StartupTiming {
    fn drop(&mut self) {
        let state = match self.0.get_mut() {
            Ok(state) => state,
            Err(poisoned) => poisoned.into_inner(),
        };
        if !state.failed
            && let Some(span) = &state.span
        {
            span.record("status", "ok");
        }
    }
}

#[cfg(test)]
#[path = "_tests_/process_startup_tests.rs"]
mod process_startup_tests;
