//! App sharding and workspace-only fixture producer requirements.

use std::str::FromStr;

use crate::command::CommandSpec;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};

#[test]
fn app_shards_build_independently_and_run_logic_only_on_the_first_shard() {
    let shard = Shard::from_str("2/4").unwrap();
    CheckRequest::new(Some(VerificationSuite::CloudApp), Some(shard), None).unwrap();
    let actual = commands_for(
        VerificationSuite::CloudApp,
        Some(shard),
        DependencyAudit::Baseline,
    );
    assert_eq!(
        actual
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "node xtask/scripts/strict-command.mjs npm run build",
            "node xtask/scripts/strict-command.mjs node xtask/scripts/require-postgres.mjs",
            "node xtask/scripts/strict-command.mjs npm run build:web --workspace \"@mokly-cloud/app\"",
            "node xtask/scripts/strict-command.mjs npm run test:browser --workspace \"@mokly-cloud/app\"",
        ]
    );
    assert_eq!(
        actual.last(),
        Some(
            &CommandSpec::new("npm")
                .args(["run", "test:browser", "--workspace", "@mokly-cloud/app"])
                .with_environment("MKC_APP_SHARD", Some("2/4"))
                .with_environment("CI", Some("1"))
                .reject_skips()
        )
    );
    let first = commands_for(
        VerificationSuite::CloudApp,
        Some(Shard::from_str("1/4").unwrap()),
        DependencyAudit::Baseline,
    );
    assert_eq!(
        first
            .iter()
            .filter(|command| command.display().contains("test:logic"))
            .count(),
        1
    );
}

#[test]
fn fixture_suite_builds_workspace_mokly_before_the_drift_check_and_dogfood() {
    let actual = commands_for(
        VerificationSuite::CloudFixtures,
        None,
        DependencyAudit::Baseline,
    );
    assert_eq!(
        actual
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "node xtask/scripts/strict-command.mjs npm run build",
            "node xtask/scripts/strict-command.mjs node xtask/scripts/mokly-fixtures.mjs --check",
            "node xtask/scripts/strict-command.mjs cargo test --locked -p mkc-mokly-contract --test dogfood",
        ]
    );
}

#[test]
fn cloud_rust_builds_the_workspace_cli_before_publication_smokes() {
    let commands = commands_for(
        VerificationSuite::CloudRust,
        None,
        DependencyAudit::Baseline,
    );
    assert_eq!(
        commands
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "node xtask/scripts/strict-command.mjs node xtask/scripts/require-postgres.mjs",
            "node xtask/scripts/strict-command.mjs cargo clippy --locked -p \"mkc-*\" --all-targets -- -D warnings",
            "node xtask/scripts/strict-command.mjs npm run build",
            "node xtask/scripts/strict-command.mjs cargo test --locked -p \"mkc-*\"",
        ]
    );
}

#[test]
fn infrastructure_requires_disposable_postgres_tools_before_its_contracts() {
    let commands = commands_for(
        VerificationSuite::CloudInfrastructure,
        None,
        DependencyAudit::Baseline,
    );
    assert_eq!(
        commands.first(),
        Some(
            &CommandSpec::new("node")
                .args(["xtask/scripts/require-postgres-tools.mjs"])
                .reject_skips()
        )
    );
}
