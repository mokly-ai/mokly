//! The repository suite plan: the audit first, then the lane group of source checks.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunConcurrentlyMock, CommandRunnerRunMock, CommandSpec};
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::request::{CheckRequest, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn repository_suite_runs_audit_first_and_includes_file_length() {
    let observed = Arc::new(Mutex::new(Vec::new()));
    let captured = observed.clone();
    let grouped = observed.clone();
    let command_runner = Arc::new(Unimock::new((
        CommandRunnerRunMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, command: &CommandSpec| {
                captured.lock().unwrap().push(vec![vec![command.display()]]);
                Ok(())
            })),
        CommandRunnerRunConcurrentlyMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, lanes: &[Vec<CommandSpec>]| {
                let lanes = lanes
                    .iter()
                    .map(|lane| lane.iter().map(CommandSpec::display).collect())
                    .collect();
                grouped.lock().unwrap().push(lanes);
                Ok(())
            })),
    )));
    let auditor = Arc::new(Unimock::new(
        RustFileLengthAuditorRunMock
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let runner = DefaultCheckRunner::new(command_runner, auditor, PathBuf::from("/workspace"));
    runner
        .run(CheckRequest::new(Some(VerificationSuite::Repository), None, None).unwrap())
        .unwrap();
    let one = |command: &str| vec![vec![command.to_owned()]];
    let lane = |commands: &[&str]| {
        commands
            .iter()
            .map(|command| (*command).to_owned())
            .collect()
    };
    assert_eq!(
        *observed.lock().unwrap(),
        [
            one("npm run dependencies:check -- --baseline"),
            one("npm ci"),
            one("npm run dependencies:check:rust"),
            one("cargo xtask boundary"),
            one("cargo xtask whitespace"),
            one("cargo xtask check-generated-types"),
            one("npm run palette:check"),
            vec![
                lane(&["npm run format:check"]),
                lane(&[
                    "npm run lint",
                    "node_modules/.bin/ast-grep test --skip-snapshot-tests",
                    "node_modules/.bin/ast-grep scan crates xtask packages apps",
                    "node --test xtask/scripts/boundary-imports.test.mjs xtask/scripts/strict-command.test.mjs xtask/scripts/isolated-postgres.test.mjs",
                    "node scripts/verification/source-file-length.mjs",
                    "node scripts/verification/repository-ratchets.mjs",
                ]),
                lane(&[
                    "cargo fmt --all -- --check",
                    "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings",
                    "cargo clippy --locked -p mokly-cli --features design-matrix --all-targets -- -D warnings",
                ]),
            ],
            one("cargo xtask build-native"),
            one("npm run build --workspace \"@mokly/ui\""),
            one("npm run build --workspace \"@mokly/model\""),
            one("npm run build --workspace \"@mokly/frame\""),
            one("npm run build --workspace \"@mokly/viewer\""),
            one("npm run build --workspace \"@mokly/mokly\""),
            one("cargo test --locked -p \"mokly-*\" -p xtask"),
        ]
    );
}
