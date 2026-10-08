//! Fail-closed complete remote verification orchestration.

use std::path::Path;

use thiserror::Error;

use crate::check::request::DependencyAudit;
use crate::remote::cleanup::contracts::BoxCleanup;
use crate::remote::cleanup::guard::CleanupGuard;
use crate::remote::contracts::Dependencies;
use crate::remote::error::{self, Result};
use crate::remote::preparation::PreparedRun;
use crate::remote::reporting::warning;
use crate::remote::snapshot::guard::{SnapshotGuard, SnapshotOwner};

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
    /// The repository suite on its box uses the requested audit mode.
    fn run(&self, dependency_audit: DependencyAudit) -> RunResult;
}

/// Runner composed entirely from trait-backed collaborators.
pub(crate) struct DefaultRemoteRunner {
    /// Shared boundaries and pure workspace path.
    pub(crate) dependencies: Dependencies,
}

impl RemoteRunner for DefaultRemoteRunner {
    fn run(&self, dependency_audit: DependencyAudit) -> RunResult {
        let snapshot = SnapshotGuard::new(&self.dependencies);
        let cleanup = CleanupGuard::new(&self.dependencies);
        let mut boxes = Vec::new();
        let preparation = self.prepare(&mut boxes, &cleanup, &snapshot);
        let prepared = match preparation {
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
        let result = match self.finish(&boxes, &prepared, &cleanup, dependency_audit) {
            Ok(()) => Ok(()),
            Err(source) => Err(Failure::Failed(source)),
        };
        snapshot.finish();
        result
    }
}

impl DefaultRemoteRunner {
    /// Execute the complete remote gate after the fallback boundary.
    fn finish(
        &self,
        boxes: &[String],
        prepared: &PreparedRun,
        cleanup: &dyn BoxCleanup,
        dependency_audit: DependencyAudit,
    ) -> Result<()> {
        let dependencies = &self.dependencies;
        let identity = &prepared.identity;
        let run = identity.run().as_str();
        let completed = self.execute(
            boxes,
            identity,
            &prepared.snapshot,
            cleanup,
            dependency_audit,
        );
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
        let aggregate_failed = match dependencies
            .aggregate
            .validate(&reports, identity.base().sha.as_str())
        {
            Ok(()) => false,
            Err(error) => {
                self.report_failure("report aggregate", &error);
                true
            }
        };
        let changed = self.fingerprint(&dependencies.workspace)? != identity.fingerprint();
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
            "summary: commands={}/11 reports={}/9 aggregate={} unchanged-tree={} run={run} base={}",
            11 - failures,
            9 - downloads,
            if aggregate_failed { "failed" } else { "passed" },
            !changed,
            identity.base().sha
        ));
        if failures != 0 || downloads != 0 || aggregate_failed || changed {
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
    pub(super) fn fingerprint(&self, cwd: &Path) -> Result<String> {
        match self.dependencies.fingerprint.read(cwd) {
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

#[cfg(test)]
#[path = "_tests_/snapshot_runner_tests.rs"]
mod snapshot_runner_tests;
