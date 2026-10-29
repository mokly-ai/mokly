//! Native hosted jobs build once before they run every Rust test.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunMock, CommandSpec};
use crate::error::Error;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn every_native_command_stays_covered_by_the_local_gate() {
    let mut local: Vec<_> = VerificationSuite::LOCAL
        .into_iter()
        .flat_map(|suite| commands_for(suite, None, DependencyAudit::Baseline))
        .collect();
    if local.contains(&CommandSpec::new("npm").args(["run", "build"])) {
        local.push(CommandSpec::new("cargo").args(["xtask", "build-native"]));
        local.push(CommandSpec::new("cargo").args(["test", "--workspace", "--no-fail-fast"]));
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
            "cargo xtask build-native",
            "cargo fmt --all -- --check",
            "cargo clippy --workspace --all-targets -- -D warnings",
            "npm run build --workspace \"@mokly/ui\"",
            "npm run build --workspace \"@mokly/viewer\"",
            "npm run build --workspace \"@mokly/mokly\"",
            "cargo test --workspace --no-fail-fast",
        ]
    );
    let runner = DefaultCheckRunner::new(
        Arc::new(Unimock::new((
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo xtask build-native"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo fmt --all -- --check"))
                .returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo clippy --workspace --all-targets -- -D warnings"))
                .returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/ui\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/viewer\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/mokly\"")).returns(Ok(())),
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo test --workspace --no-fail-fast"))
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
        Arc::new(Unimock::new(
            CommandRunnerRunMock
                .next_call(matching!((command) if command.display() == "cargo xtask build-native"))
                .returns(Err(Error::CommandFailed {
                    command: "cargo xtask build-native".into(),
                    status: "1".into(),
                })),
        )),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    );
    assert!(matches!(
        runner.run(CheckRequest::new(Some(VerificationSuite::Native), None, None).unwrap()),
        Err(Error::CommandFailed { .. })
    ));
}
