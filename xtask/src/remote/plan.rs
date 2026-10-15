//! Pure reduced remote verification inventory.

use crate::check::request::{DependencyAudit, VerificationSuite};

/// One suite assigned to exactly one box.
#[derive(Clone, Debug)]
pub(super) struct RunCommand {
    /// Stable command, report and log name.
    pub(super) name: String,
    /// Selected verification suite.
    pub(super) suite: VerificationSuite,
    /// Whether this command must produce a report.
    pub(super) report: bool,
    /// Workspace audit mode, set only for the repository command.
    pub(super) dependency_audit: Option<DependencyAudit>,
}

impl RunCommand {
    /// Format only validated identities and closed suite/shard values.
    pub(super) fn shell_command(&self, fingerprint: &str) -> String {
        let mut command = format!(
            "node scripts/verification/testbox-suite.mjs --expect {fingerprint} --suite {}",
            self.suite
        );
        if let Some(mode) = self.dependency_audit {
            command.push_str(&format!(" --dependency-audit {mode}"));
        }
        command
    }
}

/// List the same two minimum-runtime commands as hosted CI.
pub(super) fn commands(dependency_audit: DependencyAudit) -> Vec<RunCommand> {
    vec![
        RunCommand {
            name: "repository".into(),
            suite: VerificationSuite::Repository,
            report: false,
            dependency_audit: Some(dependency_audit),
        },
        RunCommand {
            name: "viewer".into(),
            suite: VerificationSuite::Viewer,
            report: true,
            dependency_audit: None,
        },
    ]
}
