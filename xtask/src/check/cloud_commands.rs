//! Cloud suites over the combined Cargo and npm workspaces.

use std::iter;

use crate::command::CommandSpec;

use super::cloud_shards::{app_commands, mockup_commands, site_commands};
use super::request::{Shard, VerificationSuite};
use super::tasks::{Task, task_commands};

pub(super) fn cloud_commands(suite: VerificationSuite, shard: Option<Shard>) -> Vec<CommandSpec> {
    let commands = match suite {
        VerificationSuite::CloudRust => vec![
            CommandSpec::new("node").args(["xtask/scripts/require-postgres.mjs"]),
            cargo(&[
                "clippy",
                "--locked",
                "-p",
                "mkc-*",
                "--all-targets",
                "--",
                "-D",
                "warnings",
            ]),
            npm(&["run", "build"]),
            cargo(&["test", "--locked", "-p", "mkc-*"]).with_environment("CI", Some("1")),
        ],
        VerificationSuite::CloudMigrations => vec![cargo(&["xtask", "migration-immutability"])],
        VerificationSuite::CloudToolchainPins => vec![cargo(&["xtask", "toolchain-pins"])],
        VerificationSuite::CloudTypecheck => built(["cloud:typecheck"]),
        VerificationSuite::CloudApp => app_commands(shard),
        VerificationSuite::CloudMockups => mockup_commands(shard),
        VerificationSuite::CloudSite => site_commands(shard),
        VerificationSuite::CloudOpenapi => vec![cargo(&["xtask", "openapi", "--check"])],
        VerificationSuite::CloudFixtures => task_commands(Task::MoklyFixtures { check: true }),
        VerificationSuite::CloudEmails => task_commands(Task::EmailTemplates { check: true }),
        VerificationSuite::CloudOpenapiLint => vec![cargo(&["xtask", "openapi-lint"])],
        VerificationSuite::CloudTerraform => {
            vec![CommandSpec::new("bash").args(["infra/scripts/check-terraform.sh"])]
        }
        VerificationSuite::CloudOriginRouter => ["typecheck", "test"]
            .into_iter()
            .map(|script| npm(&["run", script, "--workspace", "@mokly-cloud/worker"]))
            .collect(),
        VerificationSuite::CloudHelm => {
            vec![CommandSpec::new("python3").args(["infra/helm/tests/check.py"])]
        }
        VerificationSuite::CloudInfrastructure => vec![
            CommandSpec::new("node").args(["xtask/scripts/require-postgres-tools.mjs"]),
            CommandSpec::new("python3")
                .args(["infra/scripts/run-infrastructure-tests.py", "contracts"]),
            CommandSpec::new("python3")
                .args(["infra/scripts/run-infrastructure-tests.py", "storage"]),
            CommandSpec::new("bash").args(["infra/scripts/check-image.sh"]),
        ],
        VerificationSuite::CloudDesktop => {
            let mut commands = built([]);
            commands.push(CommandSpec::new("node").args(["xtask/scripts/require-postgres.mjs"]));
            commands.push(
                npm(&["test", "--workspace", "@mokly-cloud/desktop"])
                    .with_environment("CI", Some("1")),
            );
            commands
        }
        _ => Vec::new(),
    };
    commands
        .into_iter()
        .map(CommandSpec::reject_skips)
        .collect()
}

/// `npm run build`, then each root npm script in order.
pub(super) fn built<const N: usize>(scripts: [&str; N]) -> Vec<CommandSpec> {
    iter::once(npm(&["run", "build"]))
        .chain(scripts.into_iter().map(|script| npm(&["run", script])))
        .collect()
}

fn cargo(args: &[&str]) -> CommandSpec {
    CommandSpec::new("cargo").args(args.iter().copied())
}

/// One `npm` command.
pub(super) fn npm(args: &[&str]) -> CommandSpec {
    CommandSpec::new("npm").args(args.iter().copied())
}
