//! Native hosted jobs build once before they run every Rust test.

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunMock, CommandSpec};
use crate::error::Error;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn every_native_command_stays_covered_by_the_local_gate() {
    let mut local: Vec<_> = VerificationSuite::local()
        .flat_map(|suite| commands_for(suite, None, DependencyAudit::Baseline))
        .collect();
    if local.contains(&CommandSpec::new("npm").args(["run", "build"])) {
        local.push(CommandSpec::new("cargo").args(["xtask", "build-native"]));
    }
    let mokly = ["--locked", "-p", "mokly-*", "-p", "xtask"];
    for tests in [
        CommandSpec::new("cargo")
            .args(["nextest", "run"])
            .args(mokly),
        CommandSpec::new("cargo")
            .args(["test"])
            .args(mokly)
            .args(["--doc"]),
    ] {
        if local.contains(&tests) {
            local.push(tests.args(["--no-fail-fast"]));
        }
    }
    for command in commands_for(VerificationSuite::Native, None, DependencyAudit::Baseline) {
        assert!(
            local.contains(&command),
            "Native command has no local coverage: {}",
            command.display()
        );
    }
}

#[test]
fn selected_native_builds_once_then_runs_workspace_tests() {
    let commands = commands_for(VerificationSuite::Native, None, DependencyAudit::Baseline);
    assert_eq!(
        commands
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "node xtask/scripts/require-nextest.mjs",
            "cargo xtask build-native",
            "cargo fmt --all -- --check",
            "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings",
            "npm run build --workspace \"@mokly/ui\"",
            "npm run build --workspace \"@mokly/model\"",
            "npm run build --workspace \"@mokly/frame\"",
            "npm run build --workspace \"@mokly/viewer\"",
            "npm run build --workspace \"@mokly/mokly\"",
            "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast",
            "cargo test --locked -p \"mokly-*\" -p xtask --doc --no-fail-fast",
        ]
    );
    let runner = DefaultCheckRunner::new(
        Arc::new(Unimock::new((
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "node xtask/scripts/require-nextest.mjs"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo xtask build-native"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo fmt --all -- --check"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings"))
                .returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/ui\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/model\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/frame\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/viewer\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/mokly\"")).returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo test --locked -p \"mokly-*\" -p xtask --doc --no-fail-fast"))
                .returns(Ok(())),
        ))),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    );
    runner
        .run(CheckRequest::new(Some(VerificationSuite::Native), None, None).unwrap())
        .unwrap();
}

#[test]
fn native_build_failure_prevents_tests() {
    let runner = DefaultCheckRunner::new(
        Arc::new(Unimock::new((
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "node xtask/scripts/require-nextest.mjs"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo xtask build-native"))
                .returns(Err(Error::CommandFailed {
                    command: "cargo xtask build-native".into(),
                    status: "1".into(),
                })),
        ))),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    );
    assert!(matches!(
        runner.run(CheckRequest::new(Some(VerificationSuite::Native), None, None).unwrap()),
        Err(Error::CommandFailed { .. })
    ));
}

#[test]
fn native_shards_split_the_tests_and_run_lints_and_doc_tests_once() {
    let display = |shard: &str| {
        let shard = Shard::from_str(shard).unwrap();
        CheckRequest::new(Some(VerificationSuite::Native), Some(shard), None).unwrap();
        commands_for(
            VerificationSuite::Native,
            Some(shard),
            DependencyAudit::Baseline,
        )
        .iter()
        .map(CommandSpec::display)
        .collect::<Vec<_>>()
    };
    let builds = [
        "npm run build --workspace \"@mokly/ui\"",
        "npm run build --workspace \"@mokly/model\"",
        "npm run build --workspace \"@mokly/frame\"",
        "npm run build --workspace \"@mokly/viewer\"",
        "npm run build --workspace \"@mokly/mokly\"",
    ];
    let mut first = vec![
        "node xtask/scripts/require-nextest.mjs",
        "cargo xtask build-native",
        "cargo fmt --all -- --check",
        "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings",
    ];
    first.extend(builds);
    first.extend([
        "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast --partition slice:1/3",
        "cargo test --locked -p \"mokly-*\" -p xtask --doc --no-fail-fast",
    ]);
    assert_eq!(display("1/3"), first);
    let mut later = vec![
        "node xtask/scripts/require-nextest.mjs",
        "cargo xtask build-native",
    ];
    later.extend(builds);
    later.push(
        "cargo nextest run --locked -p \"mokly-*\" -p xtask --no-fail-fast --partition slice:3/3",
    );
    assert_eq!(display("3/3"), later);
}
