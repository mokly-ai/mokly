//! Pure remote verification inventory.

#[cfg(test)]
#[path = "_tests_/plan_tests.rs"]
mod plan_tests;

use crate::check::request::{DependencyAudit, VerificationSuite};

/// Number of Testboxes in the complete minimum-runtime profile.
pub(super) const COMMAND_COUNT: usize = 14;
/// Viewer plus four browser shard reports.
pub(super) const REPORT_COUNT: usize = 5;

/// A standard verification suite or the independent portable-delivery check.
#[derive(Clone, Debug)]
enum RemoteSuite {
    Check(VerificationSuite),
    StaticDelivery,
    Cloud(CloudGroup),
}

/// Logical cloud assignments before the app expands into four workers.
#[derive(Clone, Copy, Debug)]
enum CloudGroup {
    Rust,
    App,
    Web,
    Infrastructure,
}

impl CloudGroup {
    const ALL: [Self; 4] = [Self::Rust, Self::App, Self::Web, Self::Infrastructure];

    fn name(self) -> &'static str {
        match self {
            Self::Rust => "cloud-rust",
            Self::App => "cloud-app",
            Self::Web => "cloud-web",
            Self::Infrastructure => "cloud-infrastructure",
        }
    }

    fn suites(self) -> &'static [VerificationSuite] {
        match self {
            Self::Rust => &[
                VerificationSuite::CloudRust,
                VerificationSuite::CloudDesktop,
            ],
            Self::App => &[VerificationSuite::CloudApp],
            Self::Web => &[
                VerificationSuite::CloudTypecheck,
                VerificationSuite::CloudMockups,
                VerificationSuite::CloudSite,
                VerificationSuite::CloudFixtures,
                VerificationSuite::CloudEmails,
            ],
            Self::Infrastructure => &[
                VerificationSuite::CloudToolchainPins,
                VerificationSuite::CloudMigrations,
                VerificationSuite::CloudOpenapi,
                VerificationSuite::CloudOpenapiLint,
                VerificationSuite::CloudTerraform,
                VerificationSuite::CloudOriginRouter,
                VerificationSuite::CloudHelm,
                VerificationSuite::CloudInfrastructure,
            ],
        }
    }
}

impl RemoteSuite {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Check(suite) => suite.as_str(),
            Self::StaticDelivery => "static-delivery",
            Self::Cloud(group) => group.name(),
        }
    }
}

/// One suite assigned to exactly one box.
#[derive(Clone, Debug)]
pub(super) struct RunCommand {
    /// Stable command, report and log name.
    pub(super) name: String,
    /// Selected verification suite.
    suite: RemoteSuite,
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
        let mut command = if let RemoteSuite::Cloud(group) = self.suite {
            let suites = group
                .suites()
                .iter()
                .map(|suite| suite.as_str())
                .collect::<Vec<_>>()
                .join(",");
            format!(
                "node scripts/verification/refresh-source-mtimes.mjs && node xtask/scripts/testbox-cloud.mjs --expect {fingerprint} --suites {suites}"
            )
        } else {
            format!(
                "node scripts/verification/refresh-source-mtimes.mjs && node scripts/verification/testbox-suite.mjs --expect {fingerprint} --suite {}",
                self.suite.as_str()
            )
        };
        if let Some(shard) = self.shard {
            command.push_str(&format!(" --shard {shard}/4"));
        }
        if let Some(mode) = self.dependency_audit {
            command.push_str(&format!(" --dependency-audit {mode}"));
        }
        command
    }
}

/// Assign seven Mokly workers and seven cloud workers, including four app shards.
pub(super) fn commands(dependency_audit: DependencyAudit) -> Vec<RunCommand> {
    let mut commands = vec![
        RunCommand {
            name: "repository".into(),
            suite: RemoteSuite::Check(VerificationSuite::Repository),
            report: false,
            shard: None,
            dependency_audit: Some(dependency_audit),
        },
        RunCommand {
            name: "viewer".into(),
            suite: RemoteSuite::Check(VerificationSuite::Viewer),
            report: true,
            shard: None,
            dependency_audit: None,
        },
    ];
    for index in 1..=4 {
        commands.push(RunCommand {
            name: format!("browser-{index}-of-4"),
            suite: RemoteSuite::Check(VerificationSuite::Browser),
            report: true,
            shard: Some(index),
            dependency_audit: None,
        });
    }
    commands.push(RunCommand {
        name: "static-delivery".into(),
        suite: RemoteSuite::StaticDelivery,
        report: false,
        shard: None,
        dependency_audit: None,
    });
    for group in CloudGroup::ALL {
        let count = if matches!(group, CloudGroup::App) {
            4
        } else {
            1
        };
        for index in 1..=count {
            commands.push(RunCommand {
                name: if count == 4 {
                    format!("{}-{index}-of-4", group.name())
                } else {
                    group.name().into()
                },
                suite: RemoteSuite::Cloud(group),
                report: false,
                shard: (count == 4).then_some(index),
                dependency_audit: None,
            });
        }
    }
    commands
}
