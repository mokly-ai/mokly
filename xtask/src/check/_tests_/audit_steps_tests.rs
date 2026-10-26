//! In-process audit steps of the repository suite: the changed-file length
//! audit and the protocol cap ratchet beside the Node ratchets.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandRunnerRunMock;
use crate::error::Error;
use crate::length;
use crate::length::protocol_audit::ProtocolCapAuditorRunMock;
use crate::length::source_audit::SourceFileLengthAuditorRunMock;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::runner_support::{auditors, step_display};

#[test]
fn source_length_audit_supports_changed_and_all_modes() {
    let source_file_length = Unimock::new((
        SourceFileLengthAuditorRunMock
            .next_call(matching!((start, all) if *start == workspace().as_path() && !*all))
            .returns(Ok(())),
        SourceFileLengthAuditorRunMock
            .next_call(matching!((start, all) if *start == workspace().as_path() && *all))
            .returns(Ok(())),
    ));
    let runner = DefaultCheckRunner::new(
        Arc::new(Unimock::new(())),
        auditors(Unimock::new(()), source_file_length, Unimock::new(())),
        workspace(),
    );
    runner
        .source_file_length(false)
        .expect("changed-file audit succeeds");
    runner
        .source_file_length(true)
        .expect("all-file audit succeeds");
}

#[test]
fn a_failed_cap_ratchet_still_runs_the_node_ratchets_before_it_stops_the_suite() {
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
            .next_call(matching!((command) if command.display() == "node scripts/verification/repository-ratchets.mjs"))
            .returns(Ok(())),
    )));
    let auditors = auditors(
        Unimock::new(()),
        Unimock::new(
            SourceFileLengthAuditorRunMock
                .next_call(matching!((start, all) if *start == workspace().as_path() && !*all))
                .returns(Ok(())),
        ),
        Unimock::new(
            ProtocolCapAuditorRunMock
                .next_call(matching!((root) if *root == workspace().as_path()))
                .returns(Err(length::error::Error::ProtocolCaps)),
        ),
    );
    let runner = DefaultCheckRunner::new(command_runner, auditors, workspace());
    let request = CheckRequest::new(Some(VerificationSuite::Repository), None, None)
        .expect("repository request is valid");

    assert!(matches!(
        runner.run(request),
        Err(Error::Length {
            source: length::error::Error::ProtocolCaps
        })
    ));
}

#[test]
fn the_repository_suite_runs_its_steps_in_the_documented_order() {
    let steps = commands_for(
        VerificationSuite::Repository,
        None,
        DependencyAudit::Baseline,
    );
    assert_eq!(
        steps.iter().map(step_display).collect::<Vec<_>>(),
        [
            "npm run dependencies:check -- --baseline",
            "npm run dependencies:check:rust",
            "cargo xtask check-generated-types",
            "npm run format:check",
            "npm run lint",
            "source and protocol file-length audit",
            "protocol cap ratchet, then node scripts/verification/repository-ratchets.mjs",
            "cargo fmt --all -- --check",
            "cargo clippy --workspace --all-targets -- -D warnings",
            "cargo clippy -p mokly-cli --features design-matrix --all-targets -- -D warnings",
            "npm run build --workspace \"@mokly/viewer\"",
            "npm run build --workspace \"@mokly/mokly\"",
            "cargo test --workspace",
        ]
    );
}

fn workspace() -> PathBuf {
    PathBuf::from("/workspace")
}
