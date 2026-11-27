//! Pure remote verification inventory.

#[cfg(test)]
#[path = "_tests_/plan_tests.rs"]
mod plan_tests;

#[cfg(test)]
#[path = "_tests_/plan_support.rs"]
pub(super) mod plan_support;

use std::num::NonZeroU8;

use serde::Deserialize;

use crate::check::request::{DependencyAudit, VerificationSuite};
use crate::remote::error::Result;

/// The CI viewer and browser shard totals, shared with the hosted CI workflow.
const CI_SHARDS: &str = include_str!("../../../scripts/verification/ci-shards.json");

/// The cloud app keeps its own shard count, independent of the CI shard file.
const CLOUD_APP_SHARDS: u8 = 4;

/// Shard totals of the two Mokly suites that produce evidence reports.
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ShardTotals {
    /// Number of viewer shards, each on its own box.
    pub(super) viewer: NonZeroU8,
    /// Number of browser shards, each on its own box.
    pub(super) browser: NonZeroU8,
}

impl ShardTotals {
    /// Parse shard totals from the JSON text of the CI shard file.
    fn parse(text: &str) -> Result<Self> {
        Ok(serde_json::from_str(text)?)
    }

    /// Parse the CI shard file that the build embedded.
    pub(super) fn embedded() -> Result<Self> {
        Self::parse(CI_SHARDS)
    }
}

/// One one-based shard of a sharded suite.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Shard {
    /// One-based shard index, at most `total`.
    pub(super) index: u8,
    /// Number of shards of the suite.
    pub(super) total: u8,
}

/// A standard verification suite or the independent portable-delivery check.
#[derive(Clone, Copy, Debug)]
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
    fn as_str(self) -> &'static str {
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
    /// Shard of a viewer, browser or cloud app command.
    pub(super) shard: Option<Shard>,
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
        if let Some(Shard { index, total }) = self.shard {
            command.push_str(&format!(" --shard {index}/{total}"));
        }
        if let Some(mode) = self.dependency_audit {
            command.push_str(&format!(" --dependency-audit {mode}"));
        }
        command
    }
}

/// Parse the embedded CI shard totals and assign one command to each box.
pub(super) fn commands(dependency_audit: DependencyAudit) -> Result<Vec<RunCommand>> {
    Ok(commands_for(ShardTotals::embedded()?, dependency_audit))
}

/// Assign the repository, viewer, browser, delivery and cloud commands in box order.
pub(super) fn commands_for(
    totals: ShardTotals,
    dependency_audit: DependencyAudit,
) -> Vec<RunCommand> {
    let mut commands = vec![RunCommand {
        name: "repository".into(),
        suite: RemoteSuite::Check(VerificationSuite::Repository),
        report: false,
        shard: None,
        dependency_audit: Some(dependency_audit),
    }];
    commands.extend(sharded(
        RemoteSuite::Check(VerificationSuite::Viewer),
        totals.viewer.get(),
        true,
    ));
    commands.extend(sharded(
        RemoteSuite::Check(VerificationSuite::Browser),
        totals.browser.get(),
        true,
    ));
    commands.push(single(RemoteSuite::StaticDelivery));
    for group in CloudGroup::ALL {
        let suite = RemoteSuite::Cloud(group);
        if matches!(group, CloudGroup::App) {
            commands.extend(sharded(suite, CLOUD_APP_SHARDS, false));
        } else {
            commands.push(single(suite));
        }
    }
    commands
}

/// One unsharded command without a report.
fn single(suite: RemoteSuite) -> RunCommand {
    RunCommand {
        name: suite.as_str().into(),
        suite,
        report: false,
        shard: None,
        dependency_audit: None,
    }
}

/// One command per shard, named `{suite}-{index}-of-{total}`.
fn sharded(suite: RemoteSuite, total: u8, report: bool) -> impl Iterator<Item = RunCommand> {
    (1..=total).map(move |index| RunCommand {
        name: format!("{}-{index}-of-{total}", suite.as_str()),
        suite,
        report,
        shard: Some(Shard { index, total }),
        dependency_audit: None,
    })
}
