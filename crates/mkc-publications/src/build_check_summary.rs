//! Bounded, plain product copy for every unpublished build check state.

use mkc_github_interface::check::{Conclusion, ErrorResultExt, Result};
use mkc_github_interface::checks::Status;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStep};

use crate::build_check_worker::BuildCheckDelivery;
use crate::build_log_text::normalize;
use crate::error;

const SUMMARY_LIMIT: usize = 60_000;

pub(crate) trait BuildCheckOutput {
    fn output_tail(&self, build: &Build) -> Result<String>;
}

impl BuildCheckOutput for BuildCheckDelivery {
    fn output_tail(&self, build: &Build) -> Result<String> {
        if !matches!(build.state, BuildState::Failed | BuildState::TimedOut)
            || matches!(
                build.failure_cause,
                Some(
                    BuildFailure::PlanRequired
                        | BuildFailure::Infrastructure
                        | BuildFailure::RepositoryUnavailable
                )
            )
        {
            return Ok(String::new());
        }
        let mut bytes = Vec::new();
        self.transactions
            .run(true, &mut |queries| {
                let mut after = 0;
                loop {
                    let Some(window) = error::ErrorResultExt::context(
                        queries.build_log(build.project_id, build.id, after, 100),
                        "read build check output",
                    )?
                    else {
                        break;
                    };
                    if window.chunks.is_empty() {
                        break;
                    }
                    for chunk in window.chunks {
                        if chunk.sequence <= build.log_sequence {
                            bytes.extend(chunk.bytes);
                        }
                    }
                    if window.next_after <= after || window.next_after >= build.log_sequence {
                        break;
                    }
                    after = window.next_after;
                }
                Ok(())
            })
            .context("load build check output tail")?;
        let text = normalize(&bytes);
        let lines: Vec<_> = text.lines().rev().take(50).collect();
        Ok(lines.into_iter().rev().collect::<Vec<_>>().join("\n"))
    }
}

pub(crate) fn render(build: &Build, tail: &str) -> (Status, Option<Conclusion>, String, String) {
    let (status, conclusion, title, summary) = match build.state {
        BuildState::Queued => (Status::Queued, None, "Waiting to publish", String::new()),
        BuildState::Running => (
            Status::InProgress,
            None,
            "Publishing",
            step(build.step).to_owned(),
        ),
        BuildState::Superseded => (
            Status::Completed,
            Some(Conclusion::Cancelled),
            "Replaced by a newer push",
            String::new(),
        ),
        BuildState::Cancelled => (
            Status::Completed,
            Some(Conclusion::Cancelled),
            "Publishing cancelled",
            String::new(),
        ),
        BuildState::Failed if build.failure_cause == Some(BuildFailure::PlanRequired) => (
            Status::Completed,
            Some(Conclusion::Neutral),
            "Publishing to private projects is on Team",
            String::new(),
        ),
        BuildState::Failed if build.failure_cause == Some(BuildFailure::Infrastructure) => (
            Status::Completed,
            Some(Conclusion::Neutral),
            "Build couldn't run",
            "Select Re-run to try again.".to_owned(),
        ),
        BuildState::Failed if build.failure_cause == Some(BuildFailure::RepositoryUnavailable) => (
            Status::Completed,
            Some(Conclusion::Neutral),
            "Build couldn't run",
            "Restore GitHub access to this repository.".to_owned(),
        ),
        BuildState::Failed | BuildState::TimedOut => {
            let mut summary = cause(build.failure_cause).to_owned();
            let step = step(build.step);
            if !step.is_empty() {
                summary.push_str(&format!("\n\n{step}"));
            }
            if let Some(exit) = build.exit_code {
                summary.push_str(&format!("\n\nExit code: {exit}."));
            }
            append_tail(&mut summary, tail, SUMMARY_LIMIT);
            (
                Status::Completed,
                Some(Conclusion::Failure),
                "Unable to publish",
                summary,
            )
        }
        BuildState::Published => (
            Status::Completed,
            Some(Conclusion::Neutral),
            "Catalogue published.",
            String::new(),
        ),
    };
    (status, conclusion, title.to_owned(), summary)
}

/// Omit the tail when trimming leaves no text that fits with its Markdown fence.
fn append_tail(summary: &mut String, tail: &str, limit: usize) {
    if tail.is_empty() {
        return;
    }
    let available = limit.saturating_sub(summary.len());
    let mut start = tail.len().saturating_sub(available);
    loop {
        while !tail.is_char_boundary(start) {
            start += 1;
        }
        let text = &tail[start..];
        if text.is_empty() {
            return;
        }
        let fence_bytes = longest_backticks(text).max(2) + 1;
        if text.len() + fence_bytes * 2 + 8 <= available {
            let fence = "`".repeat(fence_bytes);
            summary.push_str(&format!("\n\n{fence}text\n{text}\n{fence}"));
            break;
        }
        start += text.len().div_ceil(2);
    }
}

fn step(step: Option<BuildStep>) -> &'static str {
    match step {
        Some(BuildStep::Checkout) => "Getting the repository.",
        Some(BuildStep::Install) => "Installing dependencies.",
        Some(BuildStep::Publish) => "Publishing the catalogue.",
        None => "",
    }
}

fn cause(cause: Option<BuildFailure>) -> &'static str {
    match cause {
        Some(BuildFailure::UploadRejected) => "Check the output and publish again.",
        Some(BuildFailure::UnsupportedLockfile) => "Use an npm, pnpm or Yarn lockfile.",
        Some(BuildFailure::UnsupportedMoklyVersion) => "Update Mokly to version 0.18.0 or later.",
        Some(BuildFailure::UncommittedChanges) => {
            "Add build output to .gitignore and publish again."
        }
        Some(BuildFailure::OutputLimit) => {
            "The build printed too much output; print less to publish."
        }
        Some(BuildFailure::Deadline) => "Publishing reached the time limit. Try again.",
        Some(BuildFailure::Idle) => "A command stopped producing output. Try again.",
        Some(BuildFailure::Exit) | None => "Check the command output and try again.",
        Some(
            BuildFailure::PlanRequired
            | BuildFailure::Infrastructure
            | BuildFailure::RepositoryUnavailable,
        ) => "Try again.",
    }
}

fn longest_backticks(value: &str) -> usize {
    value
        .split(|character| character != '`')
        .map(str::len)
        .max()
        .unwrap_or(0)
}

#[cfg(test)]
#[path = "_tests_/build_checks/summary_tests.rs"]
mod tests;
