//! Plan facts that remote tests read from the embedded CI shard file.

use crate::check::request::DependencyAudit;
use crate::remote::plan::{RunCommand, ShardTotals, commands};

/// Box and report counts of the complete remote gate.
pub(in crate::remote) struct PlanCounts {
    /// One box per planned command.
    pub(in crate::remote) commands: usize,
    /// Commands that must download a report.
    pub(in crate::remote) reports: usize,
}

/// Shard totals parsed from the same embedded JSON that the runner reads.
pub(in crate::remote) fn ci_shard_totals() -> ShardTotals {
    ShardTotals::embedded().unwrap()
}

/// The complete remote plan in box order.
pub(in crate::remote) fn planned_commands() -> Vec<RunCommand> {
    commands(DependencyAudit::Baseline).unwrap()
}

/// Counts of the complete remote plan, so tests follow a shard change.
pub(in crate::remote) fn plan_counts() -> PlanCounts {
    let commands = planned_commands();
    PlanCounts {
        commands: commands.len(),
        reports: commands.iter().filter(|command| command.report).count(),
    }
}
