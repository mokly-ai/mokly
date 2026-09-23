//! Verification ordering, selection, and fail-closed subprocess coverage.

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandRunnerRunMock;
use crate::error::Error;
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::{
    CheckRequest, CheckRunner, DefaultCheckRunner, Shard, VerificationSuite, commands_for,
};

#[test]
fn complete_gate_is_the_ordered_union_of_every_suite() {
    let complete = VerificationSuite::ALL
        .into_iter()
        .flat_map(|suite| commands_for(suite, None))
        .collect::<Vec<_>>();

    assert_eq!(
        complete
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "npm run dependencies:check",
            "npm run format:check",
            "npm run lint",
            "cargo fmt --all -- --check",
            "cargo clippy --workspace --all-targets -- -D warnings",
            "cargo test --workspace",
            "npm run prepare:verification",
            "npm run typecheck:prepared",
            "npm run example:check",
            "npm run package:artifacts -- --out .context/verification/package-artifacts",
            "npm run package:check:prepared -- --artifacts .context/verification/package-artifacts",
            "npm run package:smoke:prepared -- --artifacts .context/verification/package-artifacts",
            "npm run prepare:verification",
            "npm run test:prepared",
            "npm run prepare:verification",
            "npm run test:browser:prepared",
        ]
    );
}

#[test]
fn selected_unit_shard_prepares_then_propagates_the_shard() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run prepare:verification"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(
                matching!((command) if command.display() == "npm run test:prepared -- --shard 2/4"),
            )
            .returns(Ok(())),
    )));
    let auditor = Arc::new(Unimock::new(()));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(
        Some(VerificationSuite::Unit),
        Some(Shard::from_str("2/4").expect("valid shard")),
    )
    .expect("unit suites support shards");

    runner.run(request).expect("selected shard succeeds");
}

#[test]
fn repository_suite_runs_audit_first_and_includes_file_length() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run format:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run lint"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo fmt --all -- --check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo clippy --workspace --all-targets -- -D warnings"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo test --workspace"))
            .returns(Ok(())),
    )));
    let auditor = Arc::new(Unimock::new(
        RustFileLengthAuditorRunMock
            .next_call(matching!((root) if *root == workspace().as_path()))
            .returns(Ok(())),
    ));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(Some(VerificationSuite::Repository), None)
        .expect("repository request is valid");

    runner.run(request).expect("repository suite succeeds");
}

#[test]
fn dependency_check_failure_stops_verification() {
    let command_runner = Arc::new(Unimock::new(
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check"))
            .returns(Err(Error::CommandFailed {
                command: "npm run dependencies:check".to_owned(),
                status: "1".to_owned(),
            })),
    ));
    let auditor = Arc::new(Unimock::new(()));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(None, None).expect("complete request is valid");

    assert!(matches!(
        runner.run(request),
        Err(Error::CommandFailed { command, .. }) if command == "npm run dependencies:check"
    ));
}

#[test]
fn complete_gate_audits_before_starting_local_fan_out() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/local-check.mjs"))
            .returns(Ok(())),
    )));
    let runner = DefaultCheckRunner::new(command_runner, Arc::new(Unimock::new(())), workspace());

    runner
        .run(CheckRequest::new(None, None).expect("valid request"))
        .expect("the complete local runner succeeds");
}

#[test]
fn local_worker_failure_is_not_mistaken_for_unavailable_isolation() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/local-check.mjs"))
            .returns(Err(Error::CommandFailed {
                command: "node scripts/verification/local-check.mjs".to_owned(),
                status: "1".to_owned(),
            })),
    )));
    let runner = DefaultCheckRunner::new(command_runner, Arc::new(Unimock::new(())), workspace());

    assert!(
        matches!(runner.run(CheckRequest::new(None, None).expect("valid request")),
        Err(Error::CommandFailed { status, .. }) if status == "1")
    );
}

#[test]
fn subprocess_failure_is_propagated_from_a_selected_suite() {
    let command_runner = Arc::new(Unimock::new(
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run prepare:verification"))
            .returns(Err(Error::CommandFailed {
                command: "npm run prepare:verification".to_owned(),
                status: "9".to_owned(),
            })),
    ));
    let auditor = Arc::new(Unimock::new(()));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(Some(VerificationSuite::Package), None)
        .expect("package request is valid");

    assert!(matches!(
        runner.run(request),
        Err(Error::CommandFailed { command, status })
            if command == "npm run prepare:verification" && status == "9"
    ));
}

#[test]
fn malformed_and_out_of_range_shards_fail() {
    for value in [
        "",
        "1",
        "1/",
        "/4",
        "0/4",
        "5/4",
        "1/0",
        "1/2/3",
        "1/9007199254740992",
        "9007199254740992/9007199254740992",
    ] {
        assert!(
            matches!(Shard::from_str(value), Err(Error::InvalidShard { shard }) if shard == value),
            "{value:?} should fail",
        );
    }
    assert!(Shard::from_str("1/9007199254740991").is_ok());
}

#[test]
fn shard_requires_a_supported_selected_suite() {
    let shard = Shard::from_str("1/4").expect("valid shard");
    assert!(matches!(
        CheckRequest::new(None, Some(shard)),
        Err(Error::ShardRequiresSuite)
    ));
    for suite in [
        Some(VerificationSuite::Repository),
        Some(VerificationSuite::Package),
    ] {
        assert!(matches!(
            CheckRequest::new(suite, Some(shard)),
            Err(Error::UnsupportedShard { .. })
        ));
    }
}

fn workspace() -> PathBuf {
    PathBuf::from("/workspace")
}
