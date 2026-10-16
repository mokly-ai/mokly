//! Pure remote verification inventory.

use crate::check::request::{DependencyAudit, VerificationSuite};

/// Number of Testboxes in the complete minimum-runtime profile.
pub(super) const COMMAND_COUNT: usize = 6;
/// Viewer plus four browser shard reports.
pub(super) const REPORT_COUNT: usize = 5;

/// One suite assigned to exactly one box.
#[derive(Clone, Debug)]
pub(super) struct RunCommand {
    /// Stable command, report and log name.
    pub(super) name: String,
    /// Selected verification suite.
    pub(super) suite: VerificationSuite,
    /// Whether this command must produce a report.
    pub(super) report: bool,
    /// Optional browser shard index; every remote browser group has four shards.
    pub(super) shard: Option<u8>,
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
        if let Some(shard) = self.shard {
            command.push_str(&format!(" --shard {shard}/4"));
        }
        if let Some(mode) = self.dependency_audit {
            command.push_str(&format!(" --dependency-audit {mode}"));
        }
        command
    }
}

/// List the same six minimum-runtime commands as hosted CI.
pub(super) fn commands(dependency_audit: DependencyAudit) -> Vec<RunCommand> {
    let mut commands = vec![
        RunCommand {
            name: "repository".into(),
            suite: VerificationSuite::Repository,
            report: false,
            shard: None,
            dependency_audit: Some(dependency_audit),
        },
        RunCommand {
            name: "viewer".into(),
            suite: VerificationSuite::Viewer,
            report: true,
            shard: None,
            dependency_audit: None,
        },
    ];
    for index in 1..=4 {
        commands.push(RunCommand {
            name: format!("browser-{index}-of-4"),
            suite: VerificationSuite::Browser,
            report: true,
            shard: Some(index),
            dependency_audit: None,
        });
    }
    commands
}
