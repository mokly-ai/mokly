//! One error of every catalogued reason, with the data type each variant carries.

use std::borrow::Cow;

use mkc_domain::values::{self, Plan};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::build_error::BuildError;
use crate::error::ApiError;
use crate::error_data::{
    ActiveBuild, BuildIneligible, DuplicateProject, IneligibleCause, PlanRequired, PublishedBuild,
    SlugConflict, SlugField, VersionConflict,
};
use crate::upload_error::UploadError;

/// An error, and the component name of the data type its variant carries.
pub(crate) struct Sample {
    pub(crate) error: ApiError,
    pub(crate) data: Option<Cow<'static, str>>,
}

fn plain(error: ApiError) -> Sample {
    Sample { error, data: None }
}

/// The variant's signature proves that it carries `T`.
fn carrying<T: ToSchema>(variant: fn(T) -> ApiError, data: T) -> Sample {
    Sample {
        error: variant(data),
        data: Some(T::name()),
    }
}

fn slug_conflict() -> SlugConflict {
    SlugConflict {
        field: SlugField::Slug,
        suggested_slug: "available".into(),
    }
}

/// Every reason once; the tests compare these reasons with the catalogue.
pub(crate) fn samples() -> Vec<Sample> {
    vec![
        plain(ApiError::ValidationFailed),
        plain(ApiError::Build(BuildError::Unavailable)),
        carrying(
            |data| ApiError::Build(BuildError::Ineligible(data)),
            BuildIneligible {
                cause: IneligibleCause::ForkPullRequest,
            },
        ),
        carrying(
            |data| ApiError::Build(BuildError::AlreadyActive(data)),
            ActiveBuild {
                build_id: Uuid::from_u128(1).into(),
            },
        ),
        carrying(
            |data| ApiError::Build(BuildError::AlreadyPublished(data)),
            PublishedBuild {
                publication_id: Uuid::from_u128(1).into(),
            },
        ),
        plain(ApiError::GITHUB_AUTH_INVALID),
        plain(ApiError::GITHUB_EMAIL_UNVERIFIED),
        plain(ApiError::GITHUB_IDENTITY_CONFLICT),
        plain(ApiError::GITHUB_INSTALLATION_CONFLICT),
        plain(ApiError::WEBHOOK_SIGNATURE_INVALID),
        plain(ApiError::Unauthenticated),
        plain(ApiError::PermissionDenied),
        plain(ApiError::NotFound),
        carrying(
            ApiError::VersionConflict,
            VersionConflict { current_version: 2 },
        ),
        plain(ApiError::HeadChanged),
        plain(ApiError::RateLimited(60)),
        plain(ApiError::Unavailable),
        carrying(
            ApiError::DuplicateProject,
            DuplicateProject {
                existing_project_id: Uuid::from_u128(1).into(),
            },
        ),
        carrying(ApiError::SlugTaken, slug_conflict()),
        carrying(ApiError::SlugReserved, slug_conflict()),
        plain(ApiError::LastOwner),
        carrying(
            ApiError::PlanRequired,
            PlanRequired {
                required_plan: Plan::Team,
                feature: "private-projects".into(),
            },
        ),
        plain(ApiError::SubscriptionActive),
        plain(ApiError::CsrfRejected),
        plain(ApiError::DesktopGrantInvalid),
        plain(ApiError::MagicLinkInvalid),
        plain(ApiError::MagicLinkExpired),
        plain(ApiError::MagicLinkUsed),
        plain(ApiError::SessionExpired),
        plain(ApiError::TokenRevoked),
        plain(ApiError::InvitationExpired),
        plain(ApiError::AlreadyMember),
        plain(ApiError::OperationUnavailable),
        plain(ApiError::MigrationsPending),
        plain(ApiError::MethodNotAllowed),
        plain(ApiError::PayloadTooLarge),
        plain(ApiError::internal(values::Error::Role)),
        plain(ApiError::InvalidAnchor),
        plain(ApiError::ReviewClosed),
        plain(ApiError::Upload(UploadError::UnsupportedVersion)),
        plain(ApiError::Upload(UploadError::InvalidBundle)),
        plain(ApiError::Upload(UploadError::Unauthorized)),
        plain(ApiError::Upload(UploadError::Forbidden)),
        plain(ApiError::Upload(UploadError::PlanRequired)),
        plain(ApiError::Upload(UploadError::TooLarge)),
        plain(ApiError::Upload(UploadError::Unavailable)),
        plain(ApiError::Upload(UploadError::Timeout)),
        plain(ApiError::Upload(UploadError::BlobMismatch)),
        plain(ApiError::Upload(UploadError::UnknownBlob)),
        plain(ApiError::Upload(UploadError::Incomplete)),
        plain(ApiError::Upload(UploadError::Expired)),
        plain(ApiError::Upload(UploadError::internal(values::Error::Role))),
    ]
}
