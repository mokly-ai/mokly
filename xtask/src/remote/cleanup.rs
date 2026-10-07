//! Best-effort status, stop and GitHub cancellation for every warmed box.

use std::collections::{BTreeMap, BTreeSet};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::Duration;

use crate::remote::contracts::{Dependencies, GithubRunState};
use crate::remote::error::Error;
use crate::remote::parse::{box_is_completed, run_id_from_status};
use crate::remote::reporting::warning;

/// The single owner of warmed boxes that still need cleanup.
pub(super) trait BoxCleanup: Send + Sync {
    /// Track a recovered warmup identifier.
    fn track(&self, id: &str);
    /// Preserve a run ID from captured warmup or probe output for this box.
    fn record_run(&self, id: &str, output: &str);
    /// Snapshot boxes that are not stopped or proven completed.
    fn pending(&self) -> Vec<String>;
    /// Stop the requested boxes with normal status and cancellation rules.
    fn stop_boxes(&self, boxes: &[String]) -> usize;
    /// Finish cleanup and report each remaining box once.
    fn finish(&self) -> usize;
}

/// State that survives every cleanup call without resetting the retry limit.
#[derive(Clone, Copy, Default)]
struct BoxState {
    run: Option<u64>,
    attempts: usize,
    warned: bool,
}

/// Cleanup state kept alive across every runner phase and scoped worker.
pub(super) struct CleanupGuard<'a> {
    dependencies: &'a Dependencies,
    remaining: Mutex<BTreeMap<String, BoxState>>,
    /// Pass the parent runner's unwind state to cleanup worker threads.
    unwinding: AtomicBool,
}

impl<'a> CleanupGuard<'a> {
    /// Construct an empty tracker before any warmup can create a box.
    pub(super) fn new(dependencies: &'a Dependencies) -> Self {
        Self {
            dependencies,
            remaining: Mutex::new(BTreeMap::new()),
            unwinding: AtomicBool::new(false),
        }
    }

    /// Recover the box set even if a panic poisoned its lock.
    fn remaining(&self) -> MutexGuard<'_, BTreeMap<String, BoxState>> {
        match self.remaining.lock() {
            Ok(remaining) => remaining,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    /// Keep diagnostics from interrupting cleanup during panic unwinding.
    fn report(&self, message: &str) {
        self.during_unwind(|| self.dependencies.reporter.executor(message));
    }

    /// Protect each call when the runner or current cleanup thread unwinds.
    fn during_unwind<T>(&self, operation: impl FnOnce() -> T) -> Option<T> {
        if self.unwinding.load(Ordering::Relaxed) || thread::panicking() {
            catch_unwind(AssertUnwindSafe(operation)).ok()
        } else {
            Some(operation())
        }
    }

    /// Use the shared formatter without letting output stop panic cleanup.
    fn warn(&self, context: &str, error: &Error) {
        self.report(&warning(context, error));
    }

    /// Read completion proof and prefer the current status run ID.
    fn status(&self, id: &str, recorded: Option<u64>) -> (bool, Option<u64>) {
        match self.during_unwind(|| self.dependencies.blacksmith.status(id)) {
            Some(Ok(status)) => {
                if box_is_completed(&status, id) {
                    self.remaining().remove(id);
                    self.report(&format!(
                        "information: box={id} already completed; cleanup skipped"
                    ));
                    (true, None)
                } else {
                    (false, run_id_from_status(&status).or(recorded))
                }
            }
            Some(Err(error)) => {
                self.warn(&format!("status for {id} failed"), &error);
                (false, recorded)
            }
            None => (false, recorded),
        }
    }

    /// Retry one box within its shared three-attempt limit.
    fn stop_one(&self, id: &str, github: bool) {
        let Some(mut state) = self.remaining().get(id).copied() else {
            return;
        };
        if state.attempts == 3 {
            self.status(id, state.run);
            return;
        }
        let run = loop {
            if state.attempts != 0 {
                let seconds = if state.attempts == 1 { 5 } else { 10 };
                self.during_unwind(|| self.dependencies.clock.wait(Duration::from_secs(seconds)));
            }
            let (completed, run) = self.status(id, state.run);
            if completed {
                return;
            }
            state.attempts += 1;
            if let Some(record) = self.remaining().get_mut(id) {
                record.attempts = state.attempts;
            }
            match self.during_unwind(|| self.dependencies.blacksmith.stop(id)) {
                Some(Ok(())) => {
                    self.remaining().remove(id);
                    break run;
                }
                Some(Err(error)) => {
                    self.warn(&format!("could not stop {id}"), &error);
                }
                None => {}
            }
            if state.attempts == 3 {
                break run;
            }
        };
        match run {
            None => self.report(&format!(
                "warning: no GitHub run ID for {id}; cancellation skipped"
            )),
            Some(run) => {
                self.report(&format!("information: cleanup box={id} GitHub run={run}"));
                if github {
                    self.cancel(run);
                }
            }
        }
    }

    /// Suppress a cancellation warning only when a typed read proves it ended.
    fn cancel(&self, run: u64) {
        if let Some(Err(error)) = self.during_unwind(|| self.dependencies.github.cancel(run)) {
            if matches!(
                self.during_unwind(|| self.dependencies.github.state(run)),
                Some(Ok(GithubRunState::Completed))
            ) {
                self.report(&format!(
                    "information: GitHub run={run} already ended; cancellation not needed"
                ));
            } else {
                self.warn(&format!("cancellation for {run} failed"), &error);
            }
        }
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
