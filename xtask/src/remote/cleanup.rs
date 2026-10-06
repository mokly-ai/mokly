//! Best-effort status, stop and GitHub cancellation for every warmed box.

use std::collections::BTreeSet;

use crate::remote::parse::{box_is_completed, run_id_from_status};

use crate::remote::runner::DefaultRemoteRunner;

impl DefaultRemoteRunner {
    /// Stop all known boxes, preserving status-before-stop and warning-only cancel rules.
    pub(super) fn stop_boxes(&self, boxes: &[String]) -> usize {
        if boxes.is_empty() {
            return 0;
        }
        let dependencies = &self.dependencies;
        let github = match dependencies.programs.find("gh") {
            Ok(available) => available,
            Err(error) => {
                dependencies
                    .reporter
                    .executor(&format!("warning: GitHub lookup failed: {error}"));
                false
            }
        };
        let mut failures = 0;
        for id in boxes.iter().collect::<BTreeSet<_>>() {
            let run = match dependencies.blacksmith.status(id) {
                Ok(status) => {
                    if box_is_completed(&status, id) {
                        dependencies.reporter.executor(&format!(
                            "information: box={id} already completed; cleanup skipped"
                        ));
                        continue;
                    }
                    run_id_from_status(&status)
                }
                Err(error) => {
                    dependencies
                        .reporter
                        .executor(&format!("warning: status for {id} failed: {error}"));
                    None
                }
            };
            if run.is_none() {
                dependencies.reporter.executor(&format!(
                    "warning: no GitHub run ID for {id}; cancellation skipped"
                ));
            } else if let Some(run) = run {
                dependencies
                    .reporter
                    .executor(&format!("information: cleanup box={id} GitHub run={run}"));
            }
            if let Err(error) = dependencies.blacksmith.stop(id) {
                failures += 1;
                dependencies
                    .reporter
                    .executor(&format!("warning: could not stop {id}: {error}"));
            }
            if let Some(run) = run.filter(|_| github)
                && let Err(error) = dependencies.github.cancel(run)
            {
                dependencies
                    .reporter
                    .executor(&format!("warning: cancellation for {run} failed: {error}"));
            }
        }
        failures
    }
}

#[cfg(test)]
#[path = "_tests_/cleanup_tests.rs"]
mod cleanup_tests;
