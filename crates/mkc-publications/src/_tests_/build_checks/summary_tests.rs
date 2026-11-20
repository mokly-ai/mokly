//! Every build check row and safe bounded output blocks.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_github_interface::check::Conclusion;
use mkc_github_interface::checks::Status;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStep};

use crate::tests::build_fixtures::build;

use super::{append_tail, render};

#[test]
fn output_limit_summary_names_the_failure_and_recovery() {
    let mut build = build(BuildState::Failed);
    build.failure_cause = Some(BuildFailure::OutputLimit);
    let (status, conclusion, title, summary) = render(&build, "");
    assert_eq!(status, Status::Completed);
    assert_eq!(conclusion, Some(Conclusion::Failure));
    assert_eq!(title, "Unable to publish");
    assert_eq!(
        summary,
        "The build printed too much output; print less to publish."
    );
}

#[test]
fn consumer_checks_name_the_cause_step_exit_and_output() {
    for (cause, sentence) in [
        (
            BuildFailure::UncommittedChanges,
            "Add build output to .gitignore and publish again.",
        ),
        (
            BuildFailure::Exit,
            "Check the command output and try again.",
        ),
    ] {
        let mut build = build(BuildState::Failed);
        build.failure_cause = Some(cause);
        build.step = Some(BuildStep::Publish);
        build.exit_code = Some(9);
        let (status, conclusion, title, summary) = render(&build, "safe output");
        assert_eq!(status, Status::Completed);
        assert_eq!(conclusion, Some(Conclusion::Failure));
        assert_eq!(title, "Unable to publish");
        assert_eq!(
            summary,
            format!(
                "{sentence}\n\nPublishing the catalogue.\n\nExit code: 9.\n\n```text\nsafe output\n```"
            )
        );
    }
}

#[test]
fn unsupported_mokly_version_names_the_receiver_floor() {
    let mut build = build(BuildState::Failed);
    build.failure_cause = Some(BuildFailure::UnsupportedMoklyVersion);
    let (status, conclusion, title, summary) = render(&build, "");
    assert_eq!(status, Status::Completed);
    assert_eq!(conclusion, Some(Conclusion::Failure));
    assert_eq!(title, "Unable to publish");
    assert_eq!(summary, "Update Mokly to version 0.18.0 or later.");
}

#[test]
fn output_tail_with_tiny_budget_terminates_without_an_empty_fence() {
    let prefix = "Failure.";
    for limit in 0..=prefix.len() + 14 {
        for tail in ["", "x", "界", "```output```"] {
            let mut summary = prefix.to_owned();
            append_tail(&mut summary, tail, limit);
            assert_eq!(summary, prefix, "budget {limit}, tail {tail:?}");
        }
    }
}

#[test]
fn output_tail_fits_the_exact_fence_budget() {
    let mut summary = String::new();
    append_tail(&mut summary, "x", 15);
    assert_eq!(summary, "\n\n```text\nx\n```");
    assert_eq!(summary.len(), 15);
}

#[test]
fn every_build_check_table_row_has_the_required_status_conclusion_and_title() {
    for (state, cause, status, conclusion, title) in [
        (
            BuildState::Queued,
            None,
            Status::Queued,
            None,
            "Waiting to publish",
        ),
        (
            BuildState::Running,
            None,
            Status::InProgress,
            None,
            "Publishing",
        ),
        (
            BuildState::Failed,
            Some(BuildFailure::Exit),
            Status::Completed,
            Some(Conclusion::Failure),
            "Unable to publish",
        ),
        (
            BuildState::TimedOut,
            Some(BuildFailure::Deadline),
            Status::Completed,
            Some(Conclusion::Failure),
            "Unable to publish",
        ),
        (
            BuildState::Failed,
            Some(BuildFailure::PlanRequired),
            Status::Completed,
            Some(Conclusion::Neutral),
            "Publishing to private projects is on Team",
        ),
        (
            BuildState::Failed,
            Some(BuildFailure::Infrastructure),
            Status::Completed,
            Some(Conclusion::Neutral),
            "Build couldn't run",
        ),
        (
            BuildState::Failed,
            Some(BuildFailure::RepositoryUnavailable),
            Status::Completed,
            Some(Conclusion::Neutral),
            "Build couldn't run",
        ),
        (
            BuildState::Superseded,
            None,
            Status::Completed,
            Some(Conclusion::Cancelled),
            "Replaced by a newer push",
        ),
        (
            BuildState::Cancelled,
            None,
            Status::Completed,
            Some(Conclusion::Cancelled),
            "Publishing cancelled",
        ),
    ] {
        let mut build = build(state);
        build.failure_cause = cause;
        build.step = Some(BuildStep::Publish);
        build.exit_code = Some(7);
        let rendered = render(&build, "safe output");
        assert_eq!(
            (rendered.0, rendered.1, rendered.2.as_str()),
            (status, conclusion, title)
        );
        if conclusion == Some(Conclusion::Failure) {
            assert!(rendered.3.contains("Exit code: 7"));
            assert!(rendered.3.contains("Publishing the catalogue."));
        }
    }
}

#[test]
fn long_unicode_and_backtick_output_never_exceeds_the_summary_budget() {
    let mut build = build(BuildState::Failed);
    build.failure_cause = Some(BuildFailure::Exit);
    for tail in [
        "界".repeat(30_000),
        "`".repeat(70_000),
        "```\n# unsafe Markdown\n```".to_owned(),
    ] {
        let (_, _, _, summary) = render(&build, &tail);
        assert!(summary.len() <= 60_000, "{} bytes", summary.len());
        assert!(!summary.contains('\u{fffd}'));
    }
}
