//! Fail-closed complete remote verification orchestration.

use thiserror::Error;

use crate::remote::cleanup::{BoxCleanup, CleanupGuard};
use crate::remote::contracts::Dependencies;
use crate::remote::error::{self, Result};
use crate::remote::reporting::warning;

/// The stage boundary that controls automatic local fallback.
#[derive(Debug, Error)]
pub(crate) enum Failure {
    /// Preparation failed before a suite started, after successful cleanup.
    #[error("[xtask/runner] remote unavailable before suites: {0}")]
    Unavailable(#[source] error::Error),
    /// A started check, interrupt or cleanup failure cannot fall back.
    #[error("[xtask/runner] remote verification failed: {0}")]
    Failed(#[source] error::Error),
}

/// Typed remote result that cannot infer its phase from diagnostic text.
pub(crate) type RunResult = std::result::Result<(), Failure>;

/// Stateful orchestration boundary consumed through a trait object.
#[cfg_attr(test, unimock::unimock(api = [RemoteRunnerRunMock]))]
pub(crate) trait RemoteRunner: Send + Sync {
    /// Execute the complete remote gate and always clean up warmed boxes.
    fn run(&self) -> RunResult;
}

/// Runner composed entirely from trait-backed collaborators.
pub(crate) struct DefaultRemoteRunner {
    /// Shared boundaries and pure workspace path.
    pub(crate) dependencies: Dependencies,
}

impl RemoteRunner for DefaultRemoteRunner {
    fn run(&self) -> RunResult {
        let cleanup = CleanupGuard::new(&self.dependencies);
        let mut boxes = Vec::new();
        let preparation = self.prepare(&mut boxes, &cleanup);
        let (head, fingerprint, run) = match preparation {
            Ok(identity) => identity,
            Err(source) => {
                let failures = cleanup.finish();
                if self.dependencies.interrupt.requested()
                    || matches!(source, error::Error::Interrupted { .. })
                {
                    return Err(Failure::Failed(error::Error::Interrupted {
                        cleanup: failures,
                    }));
                }
                if failures != 0 {
                    return Err(Failure::Failed(error::Error::PreparationCleanup {
                        source: Box::new(source),
                        failures,
                    }));
                }
                return Err(Failure::Unavailable(source));
            }
        };
        match self.finish(&boxes, &fingerprint, &run, &head, &cleanup) {
            Ok(()) => Ok(()),
            Err(source) => Err(Failure::Failed(source)),
        }
    }
}

impl DefaultRemoteRunner {
    /// Prepare all boxes before the first suite, preserving recoverable IDs.
    fn prepare(
        &self,
        boxes: &mut Vec<String>,
        cleanup: &dyn BoxCleanup,
    ) -> Result<(String, String, String)> {
        let dependencies = &self.dependencies;
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
        self.warmup(&reference, boxes, cleanup)?;
        self.probe(boxes, &fingerprint, &head, cleanup)?;
        dependencies
            .reporter
            .executor("information: all 11 probes passed");
        Ok((head, fingerprint, run))
    }

    /// Execute the complete remote gate after the fallback boundary.
    fn finish(
        &self,
        boxes: &[String],
        fingerprint: &str,
        run: &str,
        head: &str,
        cleanup: &dyn BoxCleanup,
    ) -> Result<()> {
        let dependencies = &self.dependencies;
        let completed = self.execute(boxes, fingerprint, run, cleanup);
        let reports = dependencies
            .workspace
            .join(".context/verification-reports/remote")
            .join(run);
        let downloads = 9 - completed
            .iter()
            .filter(|completion| completion.report_downloaded)
            .count();
        let cleanup = cleanup.finish();
        if dependencies.interrupt.requested() {
            return Err(error::Error::Interrupted { cleanup });
        }
        let aggregate_failed = match dependencies.aggregate.validate(&reports, head) {
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
            return Err(error::Error::Verification {
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
    pub(super) fn report_failure(&self, context: &str, error: &error::Error) {
        self.dependencies
            .reporter
            .executor(&warning(&format!("{context} failed"), error));
        if let error::Error::Captured { output, .. } = error {
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
