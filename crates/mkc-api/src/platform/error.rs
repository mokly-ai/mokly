//! Platform policy outcomes owned by the service that enforces them.

use std::result;

use internal_error::InternalError;
use mkc_billing::error::{self, Feature};
use mkc_domain::ids::ProjectId;
use mkc_domain::values::Plan;
use thiserror::Error;

/// Platform authorization, input and lifecycle failures.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub(crate) enum Error {
    /// A verified actor is required for this operation.
    #[error("[mkc-api/platform/error] unauthenticated")]
    Unauthenticated,
    /// The actor lacks the required role.
    #[error("[mkc-api/platform/error] permission denied")]
    Forbidden,
    /// The resource is absent, inaccessible or outside its parent.
    #[error("[mkc-api/platform/error] resource not found")]
    NotFound,
    /// Input violates the platform contract.
    #[error("[mkc-api/platform/error] invalid input")]
    InvalidInput,
    /// The mutation would remove the last active workspace owner.
    #[error("[mkc-api/platform/error] last owner")]
    LastOwner,
    /// The membership, invitation or direct grant already exists.
    #[error("[mkc-api/platform/error] already a member")]
    AlreadyMember,
    /// The invitation cannot be accepted after its deadline.
    #[error("[mkc-api/platform/error] invitation expired")]
    InvitationExpired,
    /// The supplied version differs from the current version.
    #[error("[mkc-api/platform/error] version conflict: current {0}")]
    VersionConflict(i64),
    /// An existing project owns the repository/config identity.
    #[error("[mkc-api/platform/error] duplicate project: {0}")]
    DuplicateProject(ProjectId),
    /// The workspace's plan does not include the requested feature.
    #[error("[mkc-api/platform/error] {required:?} plan required for {feature:?}")]
    PlanRequired {
        /// Lowest plan that includes the feature.
        required: Plan,
        /// Refused plan-gated capability.
        feature: Feature,
    },
    /// A current or historical slug belongs to another subject.
    #[error("[mkc-api/platform/error] slug taken")]
    SlugTaken(String),
    /// A workspace slug belongs to a protected route or policy name.
    #[error("[mkc-api/platform/error] slug reserved")]
    SlugReserved(String),
    /// The requested option or operation belongs to a later milestone.
    #[error("[mkc-api/platform/error] operation unavailable")]
    OperationUnavailable,
    /// Automatic builds cannot be enabled without installation access and configuration.
    #[error("[mkc-api/platform/error] builds unavailable")]
    BuildsUnavailable,
    /// A configured billing provider could not complete required cancellation.
    #[error("[mkc-api/platform/error] dependency unavailable")]
    Unavailable,
    /// Preserved query or dependency failure, for server diagnostics only.
    #[error("[mkc-api/platform/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Result of platform policy evaluation and orchestration.
pub(crate) type Result<T> = result::Result<T, Error>;

impl From<error::Error> for Error {
    fn from(value: error::Error) -> Self {
        match value {
            error::Error::NotFound => Self::NotFound,
            error::Error::PlanRequired { required, feature } => {
                Self::PlanRequired { required, feature }
            }
            error::Error::OperationUnavailable => Self::OperationUnavailable,
            error::Error::ProviderUnavailable { .. } => Self::Unavailable,
            error::Error::Internal(source) => Self::Internal(source),
        }
    }
}
