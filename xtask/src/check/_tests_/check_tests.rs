//! Verification ordering, selection, and fail-closed subprocess coverage.

use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandRunnerRunMock;
use crate::error::Error;
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn complete_gate_covers_the_native_build_and_tests_without_repeating_them() {
    let command_runner = Arc::new(Unimock::new((
        (
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run dependencies:check -- --baseline" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run dependencies:check:rust" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        ),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "cargo xtask check-generated-types" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run format:check" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run lint" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "node scripts/verification/source-file-length.mjs" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "node scripts/verification/repository-ratchets.mjs" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "cargo fmt --all -- --check" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        (
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "cargo clippy --workspace --all-targets -- -D warnings" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "cargo clippy -p mokly-cli --features design-matrix --all-targets -- -D warnings" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        ),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/viewer\"" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/mokly\"" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "cargo test --workspace" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run typecheck" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run test:viewer:prepared" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run test:browser:prepared" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run test:delivery:prepared" && command.working_directory() == Some(Path::new("/workspace")))).returns(Ok(())),
    )));
    let auditor = Arc::new(Unimock::new(
        RustFileLengthAuditorRunMock
            .next_call(matching!((root) if *root == workspace().as_path()))
            .returns(Ok(())),
    ));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    runner
        .run(CheckRequest::new(None, None, None).unwrap())
        .unwrap();
}

#[test]
fn selected_viewer_builds_then_checks_and_tests() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run build" && command.working_directory() == Some(Path::new("/workspace"))))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run typecheck"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run test:viewer:prepared"))
            .returns(Ok(())),
    )));
    let runner = DefaultCheckRunner::new(command_runner, Arc::new(Unimock::new(())), workspace());
    let request = CheckRequest::new(Some(VerificationSuite::Viewer), None, None)
        .expect("viewer suite is valid");
    runner.run(request).expect("viewer suite succeeds");
}

#[test]
fn repository_suite_runs_audit_first_and_includes_file_length() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check -- --baseline"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check:rust"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo xtask check-generated-types"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run format:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run lint"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/source-file-length.mjs" && command.working_directory() == Some(Path::new("/workspace"))))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/repository-ratchets.mjs"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo fmt --all -- --check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo clippy --workspace --all-targets -- -D warnings"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "cargo clippy -p mokly-cli --features design-matrix --all-targets -- -D warnings"))
            .returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/viewer\"")).returns(Ok(())),
        CommandRunnerRunMock.next_call(matching!((command) if command.display() == "npm run build --workspace \"@mokly/mokly\"")).returns(Ok(())),
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
    let request = CheckRequest::new(Some(VerificationSuite::Repository), None, None)
        .expect("repository request is valid");

    runner.run(request).expect("repository suite succeeds");
}

#[test]
fn source_length_audit_supports_changed_and_all_modes() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/source-file-length.mjs"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "node scripts/verification/source-file-length.mjs --all"))
            .returns(Ok(())),
    )));
    let runner = DefaultCheckRunner::new(command_runner, Arc::new(Unimock::new(())), workspace());
    runner
        .source_file_length(false)
        .expect("changed-file audit succeeds");
    runner
        .source_file_length(true)
        .expect("all-file audit succeeds");
}

#[test]
fn dependency_check_failure_stops_verification() {
    let command_runner = Arc::new(Unimock::new(
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check -- --baseline"))
            .returns(Err(Error::CommandFailed {
                command: "npm run dependencies:check -- --baseline".to_owned(),
                status: "1".to_owned(),
            })),
    ));
    let auditor = Arc::new(Unimock::new(()));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(None, None, None).expect("complete request is valid");

    assert!(matches!(
        runner.run(request),
        Err(Error::CommandFailed { command, .. }) if command == "npm run dependencies:check -- --baseline"
    ));
}

#[test]
fn subprocess_failure_is_propagated_from_a_selected_suite() {
    let command_runner = Arc::new(Unimock::new(
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run build"))
            .returns(Err(Error::CommandFailed {
                command: "npm run build".to_owned(),
                status: "9".to_owned(),
            })),
    ));
    let auditor = Arc::new(Unimock::new(()));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    let request = CheckRequest::new(Some(VerificationSuite::Viewer), None, None)
        .expect("viewer request is valid");

    assert!(matches!(
        runner.run(request),
        Err(Error::CommandFailed { command, status })
            if command == "npm run build" && status == "9"
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
        CheckRequest::new(None, Some(shard), None),
        Err(Error::ShardRequiresSuite)
    ));
    for suite in [
        Some(VerificationSuite::Repository),
        Some(VerificationSuite::Viewer),
        Some(VerificationSuite::Native),
    ] {
        assert!(matches!(
            CheckRequest::new(suite, Some(shard), None),
            Err(Error::UnsupportedShard { .. })
        ));
    }
}

#[test]
fn browser_selection_builds_and_forwards_only_validated_shards() {
    let shard = Shard::from_str("2/4").expect("valid shard");
    CheckRequest::new(Some(VerificationSuite::Browser), Some(shard), None)
        .expect("browser supports shards");
    let commands = commands_for(
        VerificationSuite::Browser,
        Some(shard),
        DependencyAudit::Baseline,
    );
    assert_eq!(
        commands
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "npm run build",
            "npm run test:browser:prepared -- --shard 2/4"
        ]
    );
}

fn workspace() -> PathBuf {
    PathBuf::from("/workspace")
}
