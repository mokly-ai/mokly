//! Fail-closed complete remote verification orchestration.

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
        let fingerprint = dependencies.fingerprint.read()?;
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
        let completed = match self.execute(&boxes, &fingerprint, &run) {
            Ok(completed) => completed,
            Err(error) => {
                self.stop_boxes(&boxes);
                return Err(error);
            }
        };
        let reports = dependencies
            .workspace
            .join(".context/verification-reports/remote")
            .join(&run);
        let downloads = if dependencies.interrupt.requested() {
            9
        } else {
            self.download(&completed, &reports)
        };
        let cleanup = self.stop_boxes(&boxes);
        if dependencies.interrupt.requested() {
            return Err(Error::Interrupted);
        }
        let aggregate = match dependencies.aggregate.validate(&reports, &head) {
            Ok(()) => false,
            Err(error) => {
                dependencies
                    .reporter
                    .executor(&format!("warning: report aggregate failed: {error}"));
                true
            }
        };
        let changed = dependencies.fingerprint.read()? != fingerprint;
        let failures = completed
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
            !aggregate,
            !changed
        ));
        if failures != 0 || downloads != 0 || aggregate || changed || cleanup != 0 {
            return Err(Error::Verification {
                commands: failures,
                reports: downloads,
                aggregate,
                changed,
                cleanup,
            });
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/runner_tests.rs"]
mod runner_tests;

#[cfg(test)]
#[path = "_tests_/early_failure_tests.rs"]
mod early_failure_tests;
