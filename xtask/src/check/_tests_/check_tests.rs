//! Verification ordering, selection, and fail-closed subprocess coverage.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunConcurrentlyMock, CommandRunnerRunMock, CommandSpec};
use crate::error::Error;
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::request::{CheckRequest, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn complete_gate_covers_the_native_build_and_tests_without_repeating_them() {
    let observed = Arc::new(Mutex::new(Vec::new()));
    let captured = observed.clone();
    let grouped = observed.clone();
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, command: &CommandSpec| {
                assert_eq!(command.working_directory(), Some(Path::new("/workspace")));
                captured.lock().unwrap().push(command.display());
                Ok(())
            })),
        CommandRunnerRunConcurrentlyMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, lanes: &[Vec<CommandSpec>]| {
                for command in lanes.iter().flatten() {
                    assert_eq!(command.working_directory(), Some(Path::new("/workspace")));
                    grouped.lock().unwrap().push(command.display());
                }
                Ok(())
            })),
    )));
    let auditor = Arc::new(Unimock::new(
        RustFileLengthAuditorRunMock
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let runner = DefaultCheckRunner::new(command_runner, auditor, workspace());
    runner
        .run(CheckRequest::new(None, None, None).unwrap())
        .unwrap();
    let commands = observed.lock().unwrap();
    for required in [
        "cargo test --locked -p \"mokly-*\" -p xtask",
        "npm run test:viewer:prepared",
        "npm run test:browser:prepared",
        "npm run test:delivery:prepared",
        "node xtask/scripts/strict-command.mjs cargo xtask openapi --check",
        "node xtask/scripts/strict-command.mjs cargo xtask openapi-lint",
        "node xtask/scripts/strict-command.mjs bash infra/scripts/check-image.sh",
    ] {
        assert_eq!(
            commands
                .iter()
                .filter(|command| **command == required)
                .count(),
            1,
            "{required}"
        );
    }
    for suite in ["cloud-rust", "cloud-app", "cloud-desktop"] {
        let prefix = format!("node xtask/scripts/isolated-postgres.mjs {suite} ");
        assert_eq!(
            commands
                .iter()
                .filter(|command| command.starts_with(&prefix))
                .count(),
            1,
            "{suite} must get its own database in the complete gate"
        );
    }
    assert!(
        !commands
            .iter()
            .any(|command| command.contains("--suite native"))
    );
}

#[test]
fn selected_viewer_builds_then_checks_and_tests() {
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run build" && command.working_directory() == Some(Path::new("/workspace"))))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run typecheck:ci"))
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

fn workspace() -> PathBuf {
    PathBuf::from("/workspace")
}
