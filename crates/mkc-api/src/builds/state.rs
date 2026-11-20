//! Public build values mapped from the persistence interface.

use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStream, BuildTrigger};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
#[schema(as = BuildState)]
pub(crate) enum BuildStateView {
    Queued,
    Running,
    Published,
    Failed,
    TimedOut,
    Superseded,
    Cancelled,
}

impl From<BuildState> for BuildStateView {
    fn from(value: BuildState) -> Self {
        match value {
            BuildState::Queued => Self::Queued,
            BuildState::Running => Self::Running,
            BuildState::Published => Self::Published,
            BuildState::Failed => Self::Failed,
            BuildState::TimedOut => Self::TimedOut,
            BuildState::Superseded => Self::Superseded,
            BuildState::Cancelled => Self::Cancelled,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum BuildTriggerView {
    Push,
    PullRequest,
    Setup,
    Request,
    Rerun,
}

impl From<BuildTrigger> for BuildTriggerView {
    fn from(value: BuildTrigger) -> Self {
        match value {
            BuildTrigger::Push => Self::Push,
            BuildTrigger::PullRequest => Self::PullRequest,
            BuildTrigger::Setup => Self::Setup,
            BuildTrigger::Request => Self::Request,
            BuildTrigger::Rerun => Self::Rerun,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum BuildFailureView {
    Exit,
    UploadRejected,
    UnsupportedLockfile,
    UnsupportedMoklyVersion,
    UncommittedChanges,
    OutputLimit,
    Deadline,
    Idle,
    PlanRequired,
    Infrastructure,
    RepositoryUnavailable,
}

impl From<BuildFailure> for BuildFailureView {
    fn from(value: BuildFailure) -> Self {
        match value {
            BuildFailure::Exit => Self::Exit,
            BuildFailure::UploadRejected => Self::UploadRejected,
            BuildFailure::UnsupportedLockfile => Self::UnsupportedLockfile,
            BuildFailure::UnsupportedMoklyVersion => Self::UnsupportedMoklyVersion,
            BuildFailure::UncommittedChanges => Self::UncommittedChanges,
            BuildFailure::OutputLimit => Self::OutputLimit,
            BuildFailure::Deadline => Self::Deadline,
            BuildFailure::Idle => Self::Idle,
            BuildFailure::PlanRequired => Self::PlanRequired,
            BuildFailure::Infrastructure => Self::Infrastructure,
            BuildFailure::RepositoryUnavailable => Self::RepositoryUnavailable,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum BuildStreamView {
    Stdout,
    Stderr,
    System,
}

impl From<BuildStream> for BuildStreamView {
    fn from(value: BuildStream) -> Self {
        match value {
            BuildStream::Stdout => Self::Stdout,
            BuildStream::Stderr => Self::Stderr,
            BuildStream::System => Self::System,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/state_tests.rs"]
mod tests;
