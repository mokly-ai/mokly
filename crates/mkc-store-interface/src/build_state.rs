//! Finite cloud build, log and upload outcome values.

use std::result;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// A corrupt persisted build value, promoted to Internal by the adapter.
#[derive(Debug, Error)]
#[error("[mkc-store-interface/build_state] invalid persisted build value")]
pub struct ParseError;

macro_rules! state {
    ($name:ident, $doc:literal, $(($variant:ident, $value:literal, $variant_doc:literal)),+ $(,)?) => {
        #[doc = $doc]
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
        #[serde(rename_all = "kebab-case")]
        pub enum $name {
            $(#[doc = $variant_doc] $variant),+
        }

        impl $name {
            /// Stable database representation.
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }

        impl FromStr for $name {
            type Err = ParseError;

            fn from_str(value: &str) -> result::Result<Self, Self::Err> {
                match value { $($value => Ok(Self::$variant)),+, _ => Err(ParseError) }
            }
        }
    };
}

state!(
    BuildState,
    "Persisted build lifecycle state.",
    (Queued, "queued", "Waiting for an attempt."),
    (Running, "running", "An attempt owns the lease."),
    (
        Published,
        "published",
        "The attempt uploaded a ready publication."
    ),
    (Failed, "failed", "The build ended with a typed failure."),
    (TimedOut, "timed-out", "The attempt exceeded a time budget."),
    (
        Superseded,
        "superseded",
        "A newer head replaced this build."
    ),
    (Cancelled, "cancelled", "A member stopped the build."),
);

state!(
    BuildTrigger,
    "Reason a build was scheduled.",
    (Push, "push", "A default-branch push."),
    (PullRequest, "pull-request", "An open pull request changed."),
    (
        Setup,
        "setup",
        "An installation-linked project was created."
    ),
    (Request, "request", "A member requested a build."),
    (Rerun, "rerun", "A current-head check was rerequested."),
);

state!(
    BuildStep,
    "Current or failed build step.",
    (Checkout, "checkout", "Fetch and select the head."),
    (Install, "install", "Install pinned dependencies."),
    (Publish, "publish", "Run the published Mokly CLI."),
);

state!(
    BuildFailure,
    "Safe build failure cause.",
    (Exit, "exit", "A consumer command failed."),
    (
        UploadRejected,
        "upload-rejected",
        "The catalogue upload was rejected."
    ),
    (
        UnsupportedLockfile,
        "unsupported-lockfile",
        "No supported lockfile was found."
    ),
    (
        UnsupportedMoklyVersion,
        "unsupported-mokly-version",
        "The installed CLI is below the floor."
    ),
    (
        UncommittedChanges,
        "uncommitted-changes",
        "The build left worktree changes that Git does not ignore."
    ),
    (
        OutputLimit,
        "output-limit",
        "A stream exceeded its output cap."
    ),
    (
        Deadline,
        "deadline",
        "The attempt exhausted its absolute budget."
    ),
    (Idle, "idle", "A step stopped producing output."),
    (
        PlanRequired,
        "plan-required",
        "The project requires Team to publish."
    ),
    (
        Infrastructure,
        "infrastructure",
        "Mokly could not run the attempt."
    ),
    (
        RepositoryUnavailable,
        "repository-unavailable",
        "Repository access was lost."
    ),
);

state!(
    BuildStream,
    "Source of retained, redacted log bytes.",
    (Stdout, "stdout", "Process standard output."),
    (Stderr, "stderr", "Process standard error."),
    (System, "system", "Runner command and result lines."),
);

state!(
    UploadOutcome,
    "Ranked outcome of an answered build upload request.",
    (
        Accepted,
        "accepted",
        "A completion answered with a ready publication."
    ),
    (Rejected, "rejected", "A consumer upload was refused."),
    (
        PlanRequired,
        "plan-required",
        "The organization's plan refused publication."
    ),
    (Unavailable, "unavailable", "A cloud dependency failed."),
);

#[cfg(test)]
#[path = "_tests_/build_state_tests.rs"]
mod tests;
