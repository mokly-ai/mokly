//! Former cloud stages keep failure propagation at the merged runner boundary.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{CommandRunnerRunConcurrentlyMock, CommandRunnerRunMock, CommandSpec};
use crate::error::Error;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};
use super::tasks::Task;

/// Fail the target command and return the commands that ran. The failure must
/// end the suite: the target is in the last step, a command or a lane group.
fn reject(suite: VerificationSuite, target: &str) -> Vec<String> {
    reject_after_lanes(suite, target, false)
}

/// Fail the target after the suite reaches its concurrent lanes, or in them.
fn reject_grouped(suite: VerificationSuite, target: &str) -> Vec<String> {
    reject_after_lanes(suite, target, true)
}

fn reject_after_lanes(suite: VerificationSuite, target: &str, grouped: bool) -> Vec<String> {
    let steps = Arc::new(Mutex::new(Vec::<Vec<String>>::new()));
    let ran = steps.clone();
    let grouped_steps = steps.clone();
    let rejected = target.to_owned();
    let lane_rejected = target.to_owned();
    let run = CommandRunnerRunMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, command: &CommandSpec| {
            let command = command.display();
            ran.lock().unwrap().push(vec![command.clone()]);
            outcome(command, &rejected)
        }));
    let lanes = CommandRunnerRunConcurrentlyMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, lanes: &[Vec<CommandSpec>]| {
            let commands: Vec<_> = lanes.iter().flatten().map(CommandSpec::display).collect();
            grouped_steps.lock().unwrap().push(commands.clone());
            match commands
                .into_iter()
                .find(|command| *command == lane_rejected)
            {
                Some(command) => outcome(command, &lane_rejected),
                None => Ok(()),
            }
        }));
    let mock = if grouped {
        Unimock::new((run, lanes))
    } else {
        Unimock::new(run)
    };
    let runner = DefaultCheckRunner::new(
        Arc::new(mock),
        Arc::new(Unimock::new(())),
        PathBuf::from("/workspace"),
    );
    let audit = (suite == VerificationSuite::Repository).then_some(DependencyAudit::Baseline);
    let request = CheckRequest::new(Some(suite), None, audit).unwrap();
    assert!(matches!(
        runner.run(request),
        Err(Error::CommandFailed { command, status }) if command == target && status == "7"
    ));
    let steps = steps.lock().unwrap().clone();
    assert!(
        steps
            .last()
            .is_some_and(|step| step.iter().any(|command| command == target)),
        "{target} must end the suite: {steps:?}"
    );
    steps.into_iter().flatten().collect()
}

fn outcome(command: String, rejected: &str) -> Result<(), Error> {
    if command == rejected {
        Err(Error::CommandFailed {
            command,
            status: "7".into(),
        })
    } else {
        Ok(())
    }
}

#[test]
fn npm_ci_stage_rejects_manifest_lock_disagreement() {
    reject(VerificationSuite::Repository, "npm ci");
}

#[test]
fn prettier_stage_rejects_unformatted_markdown() {
    reject_grouped(VerificationSuite::Repository, "npm run format:check");
}

#[test]
fn eslint_stage_rejects_unused_typescript() {
    reject_grouped(VerificationSuite::Repository, "npm run lint");
}

#[test]
fn rust_format_stage_rejects_unformatted_source() {
    reject_grouped(VerificationSuite::Repository, "cargo fmt --all -- --check");
}

#[test]
fn clippy_stage_rejects_a_real_warning() {
    reject_grouped(
        VerificationSuite::Repository,
        "cargo clippy --locked -p \"mokly-*\" -p xtask --all-targets -- -D warnings",
    );
}

#[test]
fn test_stage_rejects_a_failing_rust_test() {
    reject_grouped(
        VerificationSuite::Repository,
        "cargo nextest run --locked -p \"mokly-*\" -p xtask",
    );
    reject_grouped(
        VerificationSuite::Repository,
        "cargo test --locked -p \"mokly-*\" -p xtask --doc",
    );
}

#[test]
fn mockup_stage_builds_before_checks_and_propagates_real_failures() {
    let expected = [
        "node xtask/scripts/strict-command.mjs npm run build",
        "node xtask/scripts/strict-command.mjs npm run mockups:build",
        "node xtask/scripts/strict-command.mjs npm run mockups:test",
        "node xtask/scripts/strict-command.mjs npm run mockups:typecheck",
    ];
    for index in 0..expected.len() {
        assert_eq!(
            reject(VerificationSuite::CloudMockups, expected[index]),
            expected[..=index]
        );
    }
}

#[test]
fn site_stage_runs_the_complete_gate_and_propagates_output_failures() {
    let expected = [
        "node xtask/scripts/strict-command.mjs npm run build",
        "node xtask/scripts/strict-command.mjs npm run site:check",
    ];
    for index in 0..expected.len() {
        assert_eq!(
            reject(VerificationSuite::CloudSite, expected[index]),
            expected[..=index]
        );
    }
}

#[test]
fn email_checks_build_workspace_output_and_reject_stale_templates_before_mutation_tests() {
    reject(
        VerificationSuite::CloudEmails,
        "node xtask/scripts/strict-command.mjs npm run emails:check",
    );
    let commands = super::tasks::task_commands(Task::EmailTemplates { check: true });
    assert_eq!(
        commands
            .iter()
            .map(CommandSpec::display)
            .collect::<Vec<_>>(),
        [
            "npm run build",
            "npm run emails:check",
            "npm run emails:test",
        ]
    );
}

#[test]
fn origin_router_stage_rejects_a_failing_worker_fixture() {
    let expected = [
        "node xtask/scripts/strict-command.mjs npm run typecheck --workspace \"@mokly-cloud/worker\"",
        "node xtask/scripts/strict-command.mjs npm run test --workspace \"@mokly-cloud/worker\"",
    ];
    for index in 0..expected.len() {
        assert_eq!(
            reject(VerificationSuite::CloudOriginRouter, expected[index]),
            expected[..=index]
        );
    }
}

#[test]
fn typecheck_suite_builds_before_running_all_cloud_workspace_typechecks() {
    assert_eq!(
        reject(
            VerificationSuite::CloudTypecheck,
            "node xtask/scripts/strict-command.mjs npm run cloud:typecheck"
        ),
        [
            "node xtask/scripts/strict-command.mjs npm run build",
            "node xtask/scripts/strict-command.mjs npm run cloud:typecheck"
        ]
    );
}

#[test]
fn desktop_suite_propagates_a_shell_failure_through_database_isolation() {
    let commands = commands_for(
        VerificationSuite::CloudDesktop,
        None,
        DependencyAudit::Baseline,
    );
    assert_eq!(
        commands.last(),
        Some(
            &CommandSpec::new("npm")
                .args(["test", "--workspace", "@mokly-cloud/desktop"])
                .with_environment("CI", Some("1"))
                .reject_skips()
        )
    );
    let target = CommandSpec::isolated_database("cloud-desktop", commands).display();
    assert_eq!(reject(VerificationSuite::CloudDesktop, &target), [target]);
}
