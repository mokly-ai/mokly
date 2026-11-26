//! Native hosted jobs build once before they run every Rust test.

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunMock, CommandSpec};
use crate::error::Error;

use super::commands::commands_for;
use super::native_scope::TestScope;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

/// The complete native nextest run: every failure, in the native scope. The
/// native scope runs a subset of the tests of the local complete run.
fn native_nextest() -> CommandSpec {
    CommandSpec::new("cargo")
        .args(["nextest", "run", "--locked", "-p", "mokly-*", "-p", "xtask"])
        .args(["--no-fail-fast"])
        .args(TestScope::Native.nextest_args())
        .keep_going()
}

#[test]
fn every_native_command_stays_covered_by_the_local_gate() {
    let mut local: Vec<_> = VerificationSuite::local()
        .flat_map(|suite| commands_for(suite, None, DependencyAudit::Baseline))
        .collect();
    if local.contains(&CommandSpec::new("npm").args(["run", "build"])) {
        local.push(CommandSpec::new("cargo").args(["xtask", "build-native"]));
    }
    let mokly = ["--locked", "-p", "mokly-*", "-p", "xtask"];
    let nextest = CommandSpec::new("cargo")
        .args(["nextest", "run"])
        .args(mokly);
    if local.contains(&nextest) {
        local.push(native_nextest());
    }
    let doc = CommandSpec::new("cargo")
        .args(["test"])
        .args(mokly)
        .args(["--doc"]);
    if local.contains(&doc) {
        local.push(doc.args(["--no-fail-fast"]));
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
            &native_nextest().display(),
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
                .next_call(matching!((command) if command.display() == native_nextest().display()))
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

/// The complete suite and the library shard keep going after a failed check or
/// failed tests, so the doc tests still run and the suite fails with the first
/// failure.
#[test]
fn failed_native_tests_still_run_the_doc_tests_and_fail_the_suite() {
    let complete = native_nextest().display();
    let library = "cargo xtask rust-test-shard --partition 1/3 --no-fail-fast --native";
    let format = "cargo fmt --all -- --check";
    for (shard, nextest) in [
        (None, complete.as_str()),
        (Some("1/3"), library),
        (Some("1/3"), format),
    ] {
        let observed = Arc::new(Mutex::new(Vec::new()));
        let captured = observed.clone();
        let failing = nextest.to_owned();
        let runner = DefaultCheckRunner::new(
            Arc::new(Unimock::new(
                CommandRunnerRunMock
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, command: &CommandSpec| {
                        let command = command.display();
                        captured.lock().unwrap().push(command.clone());
                        if command == failing {
                            Err(Error::CommandFailed {
                                command,
                                status: "100".into(),
                            })
                        } else {
                            Ok(())
                        }
                    })),
            )),
            Arc::new(Unimock::new(())),
            PathBuf::from("/workspace"),
        );
        let shard = shard.map(|shard| Shard::from_str(shard).unwrap());
        assert!(matches!(
            runner.run(CheckRequest::new(Some(VerificationSuite::Native), shard, None).unwrap()),
            Err(Error::CommandFailed { command, status }) if command == nextest && status == "100"
        ));
        assert_eq!(
            observed.lock().unwrap().last().map(String::as_str),
            Some("cargo test --locked -p \"mokly-*\" -p xtask --doc --no-fail-fast")
        );
    }
}
