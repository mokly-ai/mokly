//! Public lifecycle values mapped from the persistence interface.

use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PublicationStateView {
    Uploading,
    Validating,
    Ready,
    Failed,
    Expired,
}

impl From<PublicationState> for PublicationStateView {
    fn from(value: PublicationState) -> Self {
        match value {
            PublicationState::Uploading => Self::Uploading,
            PublicationState::Validating => Self::Validating,
            PublicationState::Ready => Self::Ready,
            PublicationState::Failed => Self::Failed,
            PublicationState::Expired => Self::Expired,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum PublicationFailureView {
    InvalidBundle,
    UnsupportedVersion,
    TooLarge,
    Unauthorized,
    Internal,
    Expired,
    Superseded,
}

impl From<PublicationFailure> for PublicationFailureView {
    fn from(value: PublicationFailure) -> Self {
        match value {
            PublicationFailure::InvalidBundle => Self::InvalidBundle,
            PublicationFailure::UnsupportedVersion => Self::UnsupportedVersion,
            PublicationFailure::TooLarge => Self::TooLarge,
            PublicationFailure::Unauthorized => Self::Unauthorized,
            PublicationFailure::Internal => Self::Internal,
            PublicationFailure::Expired => Self::Expired,
            PublicationFailure::Superseded => Self::Superseded,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/publication_state_tests.rs"]
mod tests;
