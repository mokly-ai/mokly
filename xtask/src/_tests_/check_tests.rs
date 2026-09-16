//! Verification ordering and fail-closed dependency checks.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandRunnerRunMock;
use crate::error::Error;

use super::{CheckRunner, DefaultCheckRunner};

#[test]
fn check_runs_every_gate_in_order() {
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
            .next_call(matching!((command) if command.display() == "npm run typecheck"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm test"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run example:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run package:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run package:smoke"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run site:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run test:browser"))
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
    let runner = DefaultCheckRunner::new(command_runner);

    runner.run().expect("all verification commands succeed");
}

#[test]
fn dependency_check_failure_stops_verification() {
    let command_runner = Arc::new(Unimock::new(
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run dependencies:check"))
            .returns(Err(Error::CommandFailed {
                command: "npm run dependencies:check".to_owned(),
                status: "exit status: 1".to_owned(),
            })),
    ));
    let runner = DefaultCheckRunner::new(command_runner);

    assert!(matches!(
        runner.run(),
        Err(Error::CommandFailed { command, .. }) if command == "npm run dependencies:check"
    ));
}

#[test]
fn site_check_failure_stops_before_catalogue_browser_tests() {
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
            .next_call(matching!((command) if command.display() == "npm run typecheck"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm test"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run example:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run package:check"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run package:smoke"))
            .returns(Ok(())),
        CommandRunnerRunMock
            .next_call(matching!((command) if command.display() == "npm run site:check"))
            .returns(Err(Error::CommandFailed {
                command: "npm run site:check".to_owned(),
                status: "exit status: 1".to_owned(),
            })),
    )));

    assert!(matches!(
        DefaultCheckRunner::new(command_runner).run(),
        Err(Error::CommandFailed { command, .. }) if command == "npm run site:check"
    ));
}
