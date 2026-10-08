//! Concurrent suite execution, progress logs and nine-report downloads.

use std::path::{Path, PathBuf};
use std::thread;

use crate::check::request::DependencyAudit;
use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::error::Error;
use crate::remote::plan::{RunCommand, commands};
use crate::remote::reporting::warning;

use crate::remote::runner::DefaultRemoteRunner;

/// One observed suite completion for summary and failure counting.
pub(super) struct Completion {
    /// The deterministic command assignment.
    pub(super) command: RunCommand,
    /// Assigned box.
    pub(super) box_id: String,
    /// Whether the suite returned a normal zero exit.
    pub(super) passed: bool,
    /// Milliseconds from suite start to child completion.
    pub(super) elapsed: u128,
    /// Whether the report download succeeded.
    pub(super) report_downloaded: bool,
}

impl DefaultRemoteRunner {
    /// Execute all eleven commands concurrently while keeping each stream separate.
    pub(super) fn execute(
        &self,
        boxes: &[String],
        fingerprint: &str,
        run: &str,
        cleanup: &dyn BoxCleanup,
        dependency_audit: DependencyAudit,
    ) -> Vec<Completion> {
        let dependencies = &self.dependencies;
        thread::scope(|scope| {
            let workers: Vec<_> = commands(dependency_audit)
                .into_iter()
                .zip(boxes)
                .map(|(command, id)| {
                    scope.spawn(move || {
                        if dependencies.interrupt.requested() {
                            return Completion {
                                command,
                                box_id: id.clone(),
                                passed: false,
                                elapsed: 0,
                                report_downloaded: false,
                            };
                        }
                        let start = dependencies.clock.millis();
                        let log = log_path(&dependencies.workspace, run, &command.name);
                        dependencies
                            .reporter
                            .progress(&format!("start {} box={id}", command.name));
                        let outcome = dependencies.blacksmith.run(
                            id,
                            &command.shell_command(fingerprint),
                            Some(&log),
                        );
                        let passed = match outcome {
                            Ok(output) => output.success(),
                            Err(error) => {
                                dependencies.reporter.executor(&warning(
                                    &format!("{} failed", command.name),
                                    &error,
                                ));
                                false
                            }
                        };
                        let elapsed = dependencies.clock.millis().saturating_sub(start);
                        dependencies.reporter.progress(&format!(
                            "end {} box={id} result={} duration={}ms",
                            command.name,
                            if passed { "passed" } else { "failed" },
                            elapsed
                        ));
                        if !passed {
                            match dependencies.logs.tail(&log) {
                                Ok(tail) => dependencies.reporter.progress(&format!(
                                    "{} failed; last 60 lines:\n{tail}\nlog: {}",
                                    command.name,
                                    log.display()
                                )),
                                Err(error) => {
                                    dependencies.reporter.executor(&warning(
                                        &format!("log for {} unavailable", command.name),
                                        &error,
                                    ));
                                    dependencies.reporter.progress(&format!(
                                        "{} failed; log: {}",
                                        command.name,
                                        log.display()
                                    ));
                                }
                            }
                        }
                        let report_downloaded = command.report
                            && !dependencies.interrupt.requested()
                            && self.download_one(id, &command.name, run);
                        cleanup.stop_boxes(std::slice::from_ref(id));
                        Completion {
                            command,
                            box_id: id.clone(),
                            passed,
                            elapsed,
                            report_downloaded,
                        }
                    })
                })
                .collect();
            let mut outcomes = Vec::new();
            for worker in workers {
                match worker.join() {
                    Ok(outcome) => outcomes.push(outcome),
                    Err(_) => dependencies
                        .reporter
                        .executor(&warning("suite worker failed", &Error::Worker)),
                }
            }
            outcomes
        })
    }

    /// Download one ended command's report before stopping its box.
    fn download_one(&self, id: &str, name: &str, run: &str) -> bool {
        let dependencies = &self.dependencies;
        let reports = dependencies
            .workspace
            .join(".context/verification-reports/remote")
            .join(run);
        let source = format!(".context/verification-reports/remote/{name}.json");
        let target = reports.join(format!("{name}.json"));
        if let Err(error) = dependencies.blacksmith.download(id, &source, &target) {
            dependencies
                .reporter
                .executor(&warning(&format!("report {name} failed"), &error));
            false
        } else {
            dependencies
                .reporter
                .executor(&format!("information: report {name} downloaded"));
            true
        }
    }
}

/// Pure local log path for one named command.
fn log_path(workspace: &Path, run: &str, name: &str) -> PathBuf {
    workspace
        .join(".context/verification-logs/remote")
        .join(run)
        .join(format!("{name}.log"))
}

#[cfg(test)]
#[path = "_tests_/completion_tests.rs"]
mod completion_tests;
