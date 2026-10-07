//! Best-effort status, stop and GitHub cancellation for every warmed box.

use std::collections::BTreeSet;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::{Mutex, MutexGuard};
use std::thread;

use crate::remote::contracts::Dependencies;
use crate::remote::parse::{box_is_completed, run_id_from_status};

/// The single owner of warmed boxes that still need cleanup.
pub(super) trait BoxCleanup: Send + Sync {
    /// Track a recovered warmup identifier.
    fn track(&self, id: &str);
    /// Snapshot boxes that are not stopped or proven completed.
    fn pending(&self) -> Vec<String>;
    /// Stop the requested boxes with normal status and cancellation rules.
    fn stop_boxes(&self, boxes: &[String]) -> usize;
}

/// Cleanup state kept alive across every runner phase and scoped worker.
pub(super) struct CleanupGuard<'a> {
    dependencies: &'a Dependencies,
    remaining: Mutex<BTreeSet<String>>,
}

impl<'a> CleanupGuard<'a> {
    /// Construct an empty tracker before any warmup can create a box.
    pub(super) fn new(dependencies: &'a Dependencies) -> Self {
        Self {
            dependencies,
            remaining: Mutex::new(BTreeSet::new()),
        }
    }

    /// Recover the box set even if a panic poisoned its lock.
    fn remaining(&self) -> MutexGuard<'_, BTreeSet<String>> {
        match self.remaining.lock() {
            Ok(remaining) => remaining,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    /// Keep diagnostics from interrupting cleanup during panic unwinding.
    fn report(&self, message: &str) {
        during_unwind(|| self.dependencies.reporter.executor(message));
    }
}

impl BoxCleanup for CleanupGuard<'_> {
    fn track(&self, id: &str) {
        self.remaining().insert(id.to_owned());
    }

    fn pending(&self) -> Vec<String> {
        self.remaining().iter().cloned().collect()
    }

    fn stop_boxes(&self, boxes: &[String]) -> usize {
        if boxes.is_empty() {
            return 0;
        }
        let dependencies = &self.dependencies;
        let github = match during_unwind(|| dependencies.programs.find("gh")) {
            Some(Ok(available)) => available,
            Some(Err(error)) => {
                self.report(&format!("warning: GitHub lookup failed: {error}"));
                false
            }
            None => false,
        };
        let mut failures = 0;
        for id in boxes.iter().collect::<BTreeSet<_>>() {
            let run = match during_unwind(|| dependencies.blacksmith.status(id)) {
                Some(Ok(status)) => {
                    if box_is_completed(&status, id) {
                        self.remaining().remove(id);
                        self.report(&format!(
                            "information: box={id} already completed; cleanup skipped"
                        ));
                        continue;
                    }
                    run_id_from_status(&status)
                }
                Some(Err(error)) => {
                    self.report(&format!("warning: status for {id} failed: {error}"));
                    None
                }
                None => None,
            };
            if run.is_none() {
                self.report(&format!(
                    "warning: no GitHub run ID for {id}; cancellation skipped"
                ));
            } else if let Some(run) = run {
                self.report(&format!("information: cleanup box={id} GitHub run={run}"));
            }
            match during_unwind(|| dependencies.blacksmith.stop(id)) {
                Some(Ok(())) => {
                    self.remaining().remove(id);
                }
                Some(Err(error)) => {
                    failures += 1;
                    self.report(&format!("warning: could not stop {id}: {error}"));
                }
                None => failures += 1,
            }
            if let Some(run) = run.filter(|_| github)
                && let Some(Err(error)) = during_unwind(|| dependencies.github.cancel(run))
            {
                self.report(&format!("warning: cancellation for {run} failed: {error}"));
            }
        }
        failures
    }
}

impl Drop for CleanupGuard<'_> {
    fn drop(&mut self) {
        if thread::panicking() {
            let _ = catch_unwind(AssertUnwindSafe(|| self.stop_boxes(&self.pending())));
        }
    }
}

/// Protect each cleanup call during unwind so later calls and boxes still run.
fn during_unwind<T>(operation: impl FnOnce() -> T) -> Option<T> {
    if thread::panicking() {
        catch_unwind(AssertUnwindSafe(operation)).ok()
    } else {
        Some(operation())
    }
}

#[cfg(test)]
#[path = "_tests_/cleanup_tests.rs"]
mod cleanup_tests;
