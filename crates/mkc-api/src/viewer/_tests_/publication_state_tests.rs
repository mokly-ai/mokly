//! Persistence mappings preserve every public lifecycle spelling.

#![allow(clippy::unwrap_used)]

use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use serde_json::to_value;

use super::{PublicationFailureView, PublicationStateView};

#[test]
fn state_mapping_preserves_all_wire_values() {
    for state in [
        PublicationState::Uploading,
        PublicationState::Validating,
        PublicationState::Ready,
        PublicationState::Failed,
        PublicationState::Expired,
    ] {
        assert_eq!(
            to_value(PublicationStateView::from(state)).unwrap(),
            to_value(state).unwrap()
        );
    }
}

#[test]
fn failure_mapping_preserves_all_wire_values() {
    for failure in [
        PublicationFailure::InvalidBundle,
        PublicationFailure::UnsupportedVersion,
        PublicationFailure::TooLarge,
        PublicationFailure::Unauthorized,
        PublicationFailure::Internal,
        PublicationFailure::Expired,
        PublicationFailure::Superseded,
    ] {
        assert_eq!(
            to_value(PublicationFailureView::from(failure)).unwrap(),
            to_value(failure).unwrap()
        );
    }
}
