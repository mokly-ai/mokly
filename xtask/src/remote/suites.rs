//! Concurrent suite execution, progress logs and nine-report downloads.

use std::path::{Path, PathBuf};
use std::thread;

use crate::remote::error::{Error, Result};
use crate::remote::plan::{RunCommand, commands};

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
}

impl DefaultRemoteRunner {
    /// Execute all eleven commands concurrently while keeping each stream separate.
    pub(super) fn execute(
        &self,
        boxes: &[String],
        fingerprint: &str,
        run: &str,
    ) -> Result<Vec<Completion>> {
        let dependencies = &self.dependencies;
        thread::scope(|scope| {
            let workers: Vec<_> = commands()
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
                                dependencies.reporter.executor(&format!(
                                    "warning: {} failed: {error}",
                                    command.name
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
                                Err(error) => dependencies.reporter.progress(&format!(
                                    "{} failed; log unavailable: {error}; log: {}",
                                    command.name,
                                    log.display()
                                )),
                            }
                        }
                        Completion {
                            command,
                            box_id: id.clone(),
                            passed,
                            elapsed,
                        }
                    })
                })
                .collect();
            let mut outcomes = Vec::new();
            for worker in workers {
                match worker.join() {
                    Ok(outcome) => outcomes.push(outcome),
                    Err(_) => return Err(Error::Worker),
                }
            }
            Ok(outcomes)
        })
    }

    /// Try every required report, even when a command failed.
    pub(super) fn download(&self, completed: &[Completion], reports: &Path) -> usize {
        let dependencies = &self.dependencies;
        let mut failures = 0;
        for completion in completed
            .iter()
            .filter(|completion| completion.command.report)
        {
            let name = &completion.command.name;
            let source = format!(".context/verification-reports/remote/{name}.json");
            let target = reports.join(format!("{name}.json"));
            if let Err(error) =
                dependencies
                    .blacksmith
                    .download(&completion.box_id, &source, &target)
            {
                failures += 1;
                dependencies
                    .reporter
                    .executor(&format!("warning: report {name} failed: {error}"));
            } else {
                dependencies
                    .reporter
                    .executor(&format!("information: report {name} downloaded"));
            }
        }
        failures
    }
}

/// Pure local log path for one named command.
fn log_path(workspace: &Path, run: &str, name: &str) -> PathBuf {
    workspace
        .join(".context/verification-logs/remote")
        .join(run)
        .join(format!("{name}.log"))
}
