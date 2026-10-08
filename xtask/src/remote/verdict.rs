//! The single post-cleanup decision that adds the real remaining-box count.

use std::path::Path;

use crate::remote::error::{Error, Result, TreeCheck};
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
        downloads: usize,
        reports: &Path,
        head: &str,
        fingerprint: &str,
        run: &str,
    ) -> Evidence {
        let dependencies = &self.dependencies;
        let mut cancelled = false;
        let aggregate_failed = match dependencies.aggregate.validate(reports, head) {
            Ok(()) => false,
            Err(Error::Cancelled) => {
                cancelled = true;
                true
            }
            Err(error) => {
                self.report_failure("report aggregate", &error);
                true
            }
        };
        let tree = match dependencies.fingerprint.read() {
            Ok(value) if value == fingerprint => TreeCheck::Unchanged,
            Ok(_) => TreeCheck::Changed,
            Err(Error::Cancelled) => {
                cancelled = true;
                TreeCheck::Unreadable
            }
            Err(error) => {
                self.report_failure("source fingerprint read", &error);
                TreeCheck::Unreadable
            }
        };
        let commands = 11 - completed.len()
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
            "summary: commands={}/11 reports={}/9 aggregate={} unchanged-tree={} run={run}",
            11 - commands,
            9 - downloads,
            if aggregate_failed { "failed" } else { "passed" },
            tree.unchanged()
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
