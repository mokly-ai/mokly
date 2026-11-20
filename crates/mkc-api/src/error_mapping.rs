//! Explicit translations from transport-independent errors.

use mkc_auth::error;
use mkc_domain::values;
use mkc_store_interface::error::Error;

use crate::platform;

use crate::build_error::BuildError;
use crate::error::ApiError;
use crate::error_data::{DuplicateProject, PlanRequired, SlugConflict, SlugField, VersionConflict};

impl From<values::Error> for ApiError {
    fn from(value: values::Error) -> Self {
        match value {
            values::Error::Role
            | values::Error::Visibility
            | values::Error::Plan
            | values::Error::SeatKind => Self::ValidationFailed,
        }
    }
}

impl From<error::Error> for ApiError {
    fn from(value: error::Error) -> Self {
        match value {
            error::Error::InvalidInput => Self::ValidationFailed,
            error::Error::Unauthenticated => Self::Unauthenticated,
            error::Error::SessionExpired => Self::SessionExpired,
            error::Error::CsrfFailed => Self::CsrfRejected,
            error::Error::InvalidLink => Self::MagicLinkInvalid,
            error::Error::InvalidDesktopGrant => Self::DesktopGrantInvalid,
            error::Error::PreviewSignInUnavailable => Self::OperationUnavailable,
            error::Error::LinkExpired => Self::MagicLinkExpired,
            error::Error::LinkUsed => Self::MagicLinkUsed,
            error::Error::RateLimited(seconds) => Self::RateLimited(seconds),
            error::Error::Internal(source) => Self::Internal(source),
        }
    }
}

impl From<Error> for ApiError {
    fn from(value: Error) -> Self {
        match value {
            Error::SlugTaken => Self::internal_message("slug conflict escaped platform policy"),
            Error::Internal(source) => Self::Internal(source),
        }
    }
}

impl From<platform::error::Error> for ApiError {
    fn from(value: platform::error::Error) -> Self {
        match value {
            platform::error::Error::InvalidInput => Self::ValidationFailed,
            platform::error::Error::Unauthenticated => Self::Unauthenticated,
            platform::error::Error::Forbidden => Self::PermissionDenied,
            platform::error::Error::NotFound => Self::NotFound,
            platform::error::Error::InvitationExpired => Self::InvitationExpired,
            platform::error::Error::AlreadyMember => Self::AlreadyMember,
            platform::error::Error::LastOwner => Self::LastOwner,
            platform::error::Error::BuildsUnavailable => Self::Build(BuildError::Unavailable),
            platform::error::Error::OperationUnavailable => Self::OperationUnavailable,
            platform::error::Error::Unavailable => Self::Unavailable,
            platform::error::Error::VersionConflict(current_version) => {
                Self::VersionConflict(VersionConflict { current_version })
            }
            platform::error::Error::DuplicateProject(existing_project_id) => {
                Self::DuplicateProject(DuplicateProject {
                    existing_project_id,
                })
            }
            platform::error::Error::PlanRequired { required, feature } => {
                Self::PlanRequired(PlanRequired {
                    required_plan: required,
                    feature: feature.as_str().to_owned(),
                })
            }
            platform::error::Error::SlugTaken(suggested_slug) => Self::SlugTaken(SlugConflict {
                field: SlugField::Slug,
                suggested_slug,
            }),
            platform::error::Error::SlugReserved(suggested_slug) => {
                Self::SlugReserved(SlugConflict {
                    field: SlugField::Slug,
                    suggested_slug,
                })
            }
            platform::error::Error::Internal(source) => Self::Internal(source),
        }
    }
}
