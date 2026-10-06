//! Fail-closed complete remote verification orchestration.

use std::collections::BTreeSet;

use crate::remote::contracts::Dependencies;
use crate::remote::error::{Error, Result};

/// Stateful orchestration boundary consumed through a trait object.
#[cfg_attr(test, unimock::unimock(api = [RemoteRunnerRunMock]))]
pub(crate) trait RemoteRunner: Send + Sync {
    /// Execute the complete remote gate and always clean up warmed boxes.
    fn run(&self) -> Result<()>;
}

/// Runner composed entirely from trait-backed collaborators.
pub(crate) struct DefaultRemoteRunner {
    /// Shared boundaries and pure workspace path.
    pub(crate) dependencies: Dependencies,
}

impl RemoteRunner for DefaultRemoteRunner {
    fn run(&self) -> Result<()> {
        let dependencies = &self.dependencies;
        self.require_remote()?;
        let head = dependencies.git.head()?;
        let fingerprint = self.fingerprint()?;
        let run = format!(
            "{}-{}",
            dependencies.clock.stamp(),
            dependencies.environment.pid()
        );
        dependencies.logs.prepare(&run)?;
        let reference = match dependencies.environment.get("MOKLY_TESTBOX_REF") {
            Some(reference) => reference,
            None => "main".to_owned(),
        };
        dependencies.reporter.executor(&format!(
            "information: run={run} ref={reference} HEAD={head}"
        ));
        let mut boxes = Vec::new();
        let preparation = self
            .warmup(&reference, &mut boxes)
            .and_then(|()| self.probe(&boxes, &fingerprint, &head));
        if let Err(error) = preparation {
            self.stop_boxes(&boxes);
            return Err(error);
        }
        dependencies
            .reporter
            .executor("information: all 11 probes passed");
        let completed = self.execute(&boxes, &fingerprint, &run);
        let reports = dependencies
            .workspace
            .join(".context/verification-reports/remote")
            .join(&run);
        let downloads = 9 - completed
            .iter()
            .filter(|completion| completion.report_downloaded)
            .count();
        let stopped: BTreeSet<_> = completed
            .iter()
            .filter(|completion| completion.stopped)
            .map(|completion| &completion.box_id)
            .collect();
        let remaining: Vec<_> = boxes
            .iter()
            .filter(|id| !stopped.contains(id))
            .cloned()
            .collect();
        let cleanup = completed
            .iter()
            .filter(|completion| completion.cleanup_failed)
            .count()
            + self.stop_boxes(&remaining);
        if dependencies.interrupt.requested() {
            return Err(Error::Interrupted);
        }
        let aggregate_failed = match dependencies.aggregate.validate(&reports, &head) {
            Ok(()) => false,
            Err(error) => {
                self.report_failure("report aggregate", &error);
                true
            }
        };
        let changed = self.fingerprint()? != fingerprint;
        let failures = 11 - completed.len()
            + completed
                .iter()
                .filter(|completion| !completion.passed)
                .count();
        for completion in &completed {
            dependencies.reporter.progress(&format!(
                "summary {} box={} duration={}ms result={}",
                completion.command.name,
                completion.box_id,
                completion.elapsed,
                if completion.passed {
                    "passed"
                } else {
                    "failed"
                }
            ));
        }
        dependencies.reporter.progress(&format!(
            "summary: commands={}/11 reports={}/9 aggregate={} unchanged-tree={} run={run}",
            11 - failures,
            9 - downloads,
            if aggregate_failed { "failed" } else { "passed" },
            !changed
        ));
        if failures != 0 || downloads != 0 || aggregate_failed || changed || cleanup != 0 {
            return Err(Error::Verification {
                commands: failures,
                reports: downloads,
                aggregate_failed,
                changed,
                cleanup,
            });
        }
        Ok(())
    }
}

impl DefaultRemoteRunner {
    /// Read the fingerprint and preserve failure output for diagnosis.
    fn fingerprint(&self) -> Result<String> {
        match self.dependencies.fingerprint.read() {
            Ok(value) => Ok(value),
            Err(error) => {
                self.report_failure("source fingerprint read", &error);
                Err(error)
            }
        }
    }

    /// Emit a warning before the original captured stdout and stderr.
    pub(super) fn report_failure(&self, context: &str, error: &Error) {
        self.dependencies
            .reporter
            .executor(&format!("warning: {context} failed: {error}"));
        if let Error::Captured { output, .. } = error {
            for (name, stream) in [("stdout", &output.stdout), ("stderr", &output.stderr)] {
                for line in stream.lines() {
                    self.dependencies
                        .reporter
                        .executor(&format!("information: {context} {name}: {line}"));
                }
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/runner_tests.rs"]
mod runner_tests;

#[cfg(test)]
#[path = "_tests_/early_failure_tests.rs"]
mod early_failure_tests;
