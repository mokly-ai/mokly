//! Shared box state, parallel cleanup workers and the unwind guard.

use std::collections::{BTreeMap, BTreeSet};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::thread;

use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::contracts::Dependencies;
use crate::remote::error::Error;
use crate::remote::parse::run_id_from_status;
use crate::remote::reporting::warning;

/// State that survives every cleanup call without resetting the retry limit.
#[derive(Clone, Copy, Default)]
pub(super) struct BoxState {
    /// Claim the close before its boundary call, including calls that panic.
    pub(super) disconnect_attempted: bool,
    /// Claim a cancellation before any diagnostic or GitHub boundary call.
    pub(super) cancel_attempted: bool,
    /// Report an absent run ID once after stop attempts.
    pub(super) missing_run_warned: bool,
    /// Latest run ID recovered before cancellation starts.
    pub(super) run: Option<u64>,
    /// Stop calls already used across all cleanup phases.
    pub(super) attempts: usize,
    /// Whether the final manual stop warning was printed.
    pub(super) warned: bool,
}

/// Cleanup state kept alive across every runner phase and scoped worker.
pub(in crate::remote) struct CleanupGuard<'a> {
    /// Injected cleanup collaborators.
    pub(super) dependencies: &'a Dependencies,
    /// Boxes without a successful stop or completed-status proof.
    pub(super) remaining: Mutex<BTreeMap<String, BoxState>>,
    /// Pass the parent runner's unwind state to cleanup worker threads.
    pub(super) unwinding: AtomicBool,
}

impl<'a> CleanupGuard<'a> {
    /// Construct an empty tracker before any warmup can create a box.
    pub(in crate::remote) fn new(dependencies: &'a Dependencies) -> Self {
        Self {
            dependencies,
            remaining: Mutex::new(BTreeMap::new()),
            unwinding: AtomicBool::new(false),
        }
    }

    /// Recover the box set even if a panic poisoned its lock.
    pub(super) fn remaining(&self) -> MutexGuard<'_, BTreeMap<String, BoxState>> {
        match self.remaining.lock() {
            Ok(remaining) => remaining,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    /// Keep diagnostics from interrupting cleanup during panic unwinding.
    pub(super) fn report(&self, message: &str) {
        self.during_unwind(|| self.dependencies.reporter.executor(message));
    }

    /// Protect each call when the runner or current cleanup thread unwinds.
    pub(super) fn during_unwind<T>(&self, operation: impl FnOnce() -> T) -> Option<T> {
        if self.unwinding.load(Ordering::Relaxed) || thread::panicking() {
            catch_unwind(AssertUnwindSafe(operation)).ok()
        } else {
            Some(operation())
        }
    }

    /// Use the shared formatter without letting output stop panic cleanup.
    pub(super) fn warn(&self, context: &str, error: &Error) {
        self.report(&warning(context, error));
    }
}

impl BoxCleanup for CleanupGuard<'_> {
    fn track(&self, id: &str) {
        self.remaining().entry(id.to_owned()).or_default();
    }

    fn record_run(&self, id: &str, output: &str) {
        if let Some(run) = run_id_from_status(output)
            && let Some(state) = self.remaining().get_mut(id)
        {
            state.run = Some(run);
        }
    }

    fn pending(&self) -> Vec<String> {
        self.remaining().keys().cloned().collect()
    }

    fn stop_boxes(&self, boxes: &[String]) -> usize {
        if boxes.is_empty() {
            return 0;
        }
        let github = match self.during_unwind(|| self.dependencies.programs.find("gh")) {
            Some(Ok(available)) => available,
            Some(Err(error)) => {
                self.warn("GitHub lookup failed", &error);
                false
            }
            None => false,
        };
        let boxes: BTreeSet<_> = boxes.iter().collect();
        thread::scope(|scope| {
            let workers: Vec<_> = boxes
                .iter()
                .map(|id| {
                    let id = *id;
                    (id, scope.spawn(move || self.stop_one(id, github)))
                })
                .collect();
            for (id, worker) in workers {
                if worker.join().is_err() {
                    self.warn(&format!("cleanup worker for {id} failed"), &Error::Worker);
                }
            }
        });
        let remaining = self.remaining();
        boxes
            .iter()
            .filter(|id| remaining.contains_key(id.as_str()))
            .count()
    }

    fn finish(&self) -> usize {
        self.stop_boxes(&self.pending());
        let (failures, warnings) = {
            let mut remaining = self.remaining();
            let warnings: Vec<_> = remaining
                .iter_mut()
                .filter_map(|(id, state)| {
                    if state.warned {
                        return None;
                    }
                    state.warned = true;
                    Some(id.clone())
                })
                .collect();
            (remaining.len(), warnings)
        };
        for id in warnings {
            self.report(&format!("warning: box={id} cleanup failed; run blacksmith testbox stop --id {id}; the 30-minute idle timeout ends it"));
        }
        failures
    }
}

impl Drop for CleanupGuard<'_> {
    fn drop(&mut self) {
        if thread::panicking() {
            self.unwinding.store(true, Ordering::Relaxed);
            let _ = catch_unwind(AssertUnwindSafe(|| self.finish()));
        }
    }
}

#[cfg(test)]
#[path = "_tests_/cleanup_tests.rs"]
mod cleanup_tests;

#[cfg(test)]
#[path = "_tests_/cleanup_retry_tests.rs"]
mod cleanup_retry_tests;

#[cfg(test)]
#[path = "_tests_/cleanup_parallel_tests.rs"]
mod cleanup_parallel_tests;

#[cfg(test)]
#[path = "_tests_/cancel_order_tests.rs"]
mod cancel_order_tests;
