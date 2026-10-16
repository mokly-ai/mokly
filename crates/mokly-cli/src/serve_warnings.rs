//! Attempt fences serialize warning delivery with readiness and failure output.

use std::collections::BTreeSet;
use std::mem;
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::{Warning, normalize_warnings};
use mokly_cli::build_output;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_server::warnings::RenderWarnings;

use crate::terminal::Terminal;

/// Process-wide admission for captured attempt handles.
#[cfg_attr(test, unimock::unimock(api = WarningScopesMock))]
pub(super) trait WarningScopes: Send + Sync {
    /// Retire old producers before preparation and retain only a failed scope's seen set.
    fn begin(&self) -> Arc<dyn AttemptWarnings>;
    /// Resource-only reloads retain the current fence and warning identities.
    fn current(&self) -> Arc<dyn AttemptWarnings>;
}

/// Completion and render diagnostics for one captured attempt.
pub trait AttemptWarnings: RenderWarnings {
    /// Print new sorted warnings and the result atomically with respect to producers.
    /// The output callback must not reenter the warning scope.
    /// Only preparation or adoption failure retains seen records for the next attempt.
    fn finish(&self, warnings: &[Warning], failed: bool, output: &dyn Fn(&[Warning]));
    /// Flush a fatal Serve error's pending records after render cancellation.
    fn terminate(&self, output: &dyn Fn(&[Warning]));
}

#[derive(Default)]
struct State {
    number: u64,
    pending: Vec<Warning>,
    seen: BTreeSet<Warning>,
    ready: bool,
    failed: bool,
}

/// CLI-owned warning state shared with every document backend.
#[derive(Clone)]
pub(super) struct ServeWarnings {
    state: Arc<Mutex<State>>,
    cancellation: Arc<dyn Cancellation>,
    terminal: Arc<dyn Terminal>,
    style: Style,
    redactor: Arc<Redactor>,
}

impl ServeWarnings {
    /// Construct an empty scope without admitting an attempt or writing output.
    pub(super) fn new(
        cancellation: Arc<dyn Cancellation>,
        terminal: Arc<dyn Terminal>,
        style: Style,
        redactor: Arc<Redactor>,
    ) -> Self {
        Self {
            state: Arc::new(Mutex::new(State::default())),
            cancellation,
            terminal,
            style,
            redactor,
        }
    }
}

impl WarningScopes for ServeWarnings {
    fn begin(&self) -> Arc<dyn AttemptWarnings> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.number += 1;
        state.pending.clear();
        if !state.failed {
            state.seen.clear();
        }
        state.ready = false;
        state.failed = false;
        Arc::new(Attempt {
            number: state.number,
            owner: self.clone(),
        })
    }

    fn current(&self) -> Arc<dyn AttemptWarnings> {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        Arc::new(Attempt {
            number: state.number,
            owner: self.clone(),
        })
    }
}

struct Attempt {
    number: u64,
    owner: ServeWarnings,
}

impl RenderWarnings for Attempt {
    fn report(&self, warnings: &[Warning], failed: bool) {
        if warnings.is_empty() && !failed {
            return;
        }
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.number != self.number || self.owner.cancellation.requested() {
            return;
        }
        state.pending.extend_from_slice(warnings);
        if state.ready || failed {
            let warnings = take_new(&mut state);
            if !warnings.is_empty() {
                self.owner.terminal.stderr(&build_output::warnings(
                    &self.owner.style,
                    &warnings,
                    &self.owner.redactor,
                ));
            }
        }
    }
}

impl AttemptWarnings for Attempt {
    fn finish(&self, warnings: &[Warning], failed: bool, output: &dyn Fn(&[Warning])) {
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.number != self.number || self.owner.cancellation.requested() {
            return;
        }
        state.pending.extend_from_slice(warnings);
        state.failed |= failed;
        let warnings = take_new(&mut state);
        output(&warnings);
        state.ready = true;
    }
    fn terminate(&self, output: &dyn Fn(&[Warning])) {
        let mut state = self
            .owner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.number == self.number {
            output(&take_new(&mut state));
            state.ready = true;
        }
    }
}

fn take_new(state: &mut State) -> Vec<Warning> {
    let mut warnings = mem::take(&mut state.pending);
    normalize_warnings(&mut warnings);
    warnings.retain(|warning| state.seen.insert(warning.clone()));
    warnings
}

#[cfg(test)]
#[path = "_tests_/serve_warnings_tests.rs"]
mod serve_warnings_tests;
