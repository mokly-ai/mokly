//! Store mappings keep every serialized build value unchanged.

#![allow(clippy::unwrap_used)]

use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStream, BuildTrigger};
use serde_json::to_value;

use super::{BuildFailureView, BuildStateView, BuildStreamView, BuildTriggerView};

#[test]
fn state_mapping_preserves_all_wire_values() {
    for value in [
        BuildState::Queued,
        BuildState::Running,
        BuildState::Published,
        BuildState::Failed,
        BuildState::TimedOut,
        BuildState::Superseded,
        BuildState::Cancelled,
    ] {
        assert_eq!(
            to_value(BuildStateView::from(value)).unwrap(),
            to_value(value).unwrap()
        );
    }
}

#[test]
fn trigger_mapping_preserves_all_wire_values() {
    for value in [
        BuildTrigger::Push,
        BuildTrigger::PullRequest,
        BuildTrigger::Setup,
        BuildTrigger::Request,
        BuildTrigger::Rerun,
    ] {
        assert_eq!(
            to_value(BuildTriggerView::from(value)).unwrap(),
            to_value(value).unwrap()
        );
    }
}

#[test]
fn failure_mapping_preserves_all_wire_values() {
    for value in [
        BuildFailure::Exit,
        BuildFailure::UploadRejected,
        BuildFailure::UnsupportedLockfile,
        BuildFailure::UnsupportedMoklyVersion,
        BuildFailure::UncommittedChanges,
        BuildFailure::OutputLimit,
        BuildFailure::Deadline,
        BuildFailure::Idle,
        BuildFailure::PlanRequired,
        BuildFailure::Infrastructure,
        BuildFailure::RepositoryUnavailable,
    ] {
        assert_eq!(
            to_value(BuildFailureView::from(value)).unwrap(),
            to_value(value).unwrap()
        );
    }
}

#[test]
fn stream_mapping_preserves_all_wire_values() {
    for value in [
        BuildStream::Stdout,
        BuildStream::Stderr,
        BuildStream::System,
    ] {
        assert_eq!(
            to_value(BuildStreamView::from(value)).unwrap(),
            to_value(value).unwrap()
        );
    }
}
