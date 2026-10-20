//! The single post-cleanup decision that adds the real remaining-box count.

use std::path::Path;

use crate::remote::error::{Error, Result, TreeCheck};
use crate::remote::identity::RunIdentity;
use crate::remote::plan::{COMMAND_COUNT, REPORT_COUNT};
use crate::remote::runner::DefaultRemoteRunner;
use crate::remote::suites::Completion;

/// Evidence read after final cleanup, before the count is attached.
pub(super) struct Evidence {
    /// Failed or missing suite commands.
    commands: usize,
    /// Failed report downloads.
    reports: usize,
    /// Aggregate validation failure.
    aggregate_failed: bool,
    /// Final source-tree comparison.
    tree: TreeCheck,
    /// A step after final cleanup saw an interrupt.
    cancelled: bool,
}

/// Attach the final cleanup count to every failed or interrupted result.
pub(super) fn conclude(
    cleanup: usize,
    interrupted: bool,
    evidence: Option<Evidence>,
) -> Result<()> {
    let Some(evidence) = evidence.filter(|evidence| !interrupted && !evidence.cancelled) else {
        return Err(Error::Interrupted { cleanup });
    };
    if evidence.commands != 0
        || evidence.reports != 0
        || evidence.aggregate_failed
        || evidence.tree != TreeCheck::Unchanged
    {
        return Err(Error::Verification {
            commands: evidence.commands,
            reports: evidence.reports,
            aggregate_failed: evidence.aggregate_failed,
            tree: evidence.tree,
            cleanup,
        });
    }
    Ok(())
}

impl DefaultRemoteRunner {
    /// Validate reports, compare the tree and print summaries with no early return.
    pub(super) fn evidence(
        &self,
        completed: &[Completion],
        reports: &Path,
        identity: &RunIdentity,
        cleanup: usize,
    ) -> Evidence {
        let dependencies = &self.dependencies;
        let run = identity.run().as_str();
        let downloads = REPORT_COUNT
            - completed
                .iter()
                .filter(|completion| completion.report_downloaded)
                .count();
        let mut cancelled = false;
        let aggregate_failed = match dependencies
            .aggregate
            .validate(reports, identity.base().sha.as_str())
        {
            Ok(()) => false,
            Err(error) => {
                cancelled |= matches!(error, Error::Cancelled);
                self.report_failure("report aggregate", &error);
                true
            }
        };
        let tree = match dependencies.fingerprint.read(&dependencies.workspace) {
            Ok(value) if value == identity.fingerprint() => TreeCheck::Unchanged,
            Ok(_) => TreeCheck::Changed,
            Err(error) => {
                cancelled |= matches!(error, Error::Cancelled);
                self.report_failure("source fingerprint read", &error);
                TreeCheck::Unreadable
            }
        };
        let commands = COMMAND_COUNT - completed.len()
            + completed
                .iter()
                .filter(|completion| !completion.passed)
                .count();
        for completion in completed {
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
            "summary: commands={}/{COMMAND_COUNT} reports={}/{REPORT_COUNT} aggregate={} unchanged-tree={} run={run} base={} cleanup={cleanup}",
            COMMAND_COUNT - commands,
            REPORT_COUNT - downloads,
            if aggregate_failed { "failed" } else { "passed" },
            tree.unchanged(),
            identity.base().sha
        ));
        Evidence {
            commands,
            reports: downloads,
            aggregate_failed,
            tree,
            cancelled,
        }
    }
}
