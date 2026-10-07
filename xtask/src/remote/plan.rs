//! Pure eleven-command remote verification inventory.

use crate::check::request::{DependencyAudit, VerificationSuite};

/// One suite assigned to exactly one box.
#[derive(Clone, Debug)]
pub(super) struct RunCommand {
    /// Stable command, report and log name.
    pub(super) name: String,
    /// Selected verification suite.
    pub(super) suite: VerificationSuite,
    /// Optional one-based shard out of four.
    pub(super) shard: Option<u8>,
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
        if let Some(shard) = self.shard {
            command.push_str(&format!(" --shard {shard}/4"));
        }
        if let Some(mode) = self.dependency_audit {
            command.push_str(&format!(" --dependency-audit {mode}"));
        }
        command
    }
}

/// List the same eleven minimum-runtime commands as hosted CI.
pub(super) fn commands(dependency_audit: DependencyAudit) -> Vec<RunCommand> {
    let mut commands = vec![
        RunCommand {
            name: "repository".into(),
            suite: VerificationSuite::Repository,
            shard: None,
            report: false,
            dependency_audit: Some(dependency_audit),
        },
        RunCommand {
            name: "package".into(),
            suite: VerificationSuite::Package,
            shard: None,
            report: false,
            dependency_audit: None,
        },
    ];
    for suite in [VerificationSuite::Unit, VerificationSuite::Browser] {
        for index in 1..=4 {
            commands.push(RunCommand {
                name: format!("{suite}-{index}-of-4"),
                suite,
                shard: Some(index),
                report: true,
                dependency_audit: None,
            });
        }
    }
    commands.push(RunCommand {
        name: "hydration".into(),
        suite: VerificationSuite::Hydration,
        shard: None,
        report: true,
        dependency_audit: None,
    });
    commands
}
