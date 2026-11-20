//! The sole HTTP error contract; dependency errors are translated at this boundary.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

use crate::build_error::BuildError;
use crate::error_data::{DuplicateProject, PlanRequired, SlugConflict, VersionConflict};
use crate::github_error::GitHubError;
use crate::upload_error::UploadError;

/// Stable HTTP reasons with client-safe messages and optional typed data.
#[derive(Debug, Error, internal_error::ErrorContract, rpc_error::RpcError)]
pub enum ApiError {
    /// Cloud build and Automatic builds refusals.
    #[error("[mkc-api/error] build: {0}")]
    #[delegate]
    Build(BuildError),
    /// GitHub sign-in, installation and webhook reasons.
    #[error("[mkc-api/error] github: {0}")]
    #[delegate]
    GitHub(GitHubError),
    /// Publication upload reasons retain the producer's HTTP status contract.
    #[error("[mkc-api/error] upload: {0}")]
    #[delegate]
    Upload(UploadError),
    /// Check the details and try again.
    #[error("[mkc-api/error] validation-failed")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "validation-failed",
        message = "Check the details and try again."
    )]
    ValidationFailed,
    /// Sign in to continue.
    #[error("[mkc-api/error] unauthenticated")]
    #[rpc_error(
        code = "unauthenticated",
        severity = "warn",
        reason = "unauthenticated",
        message = "Sign in to continue."
    )]
    Unauthenticated,
    /// Ask an administrator for access.
    #[error("[mkc-api/error] permission-denied")]
    #[rpc_error(
        code = "permission-denied",
        severity = "warn",
        reason = "permission-denied",
        message = "Ask an administrator for access."
    )]
    PermissionDenied,
    /// This item is unavailable.
    #[error("[mkc-api/error] not-found")]
    #[rpc_error(
        code = "not-found",
        severity = "warn",
        reason = "not-found",
        message = "This item is unavailable."
    )]
    NotFound,
    /// Refresh to see the latest changes.
    #[error("[mkc-api/error] version-conflict")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "version-conflict",
        message = "Refresh to see the latest changes."
    )]
    VersionConflict(VersionConflict),
    /// Refresh to see the latest publication.
    #[error("[mkc-api/error] head-changed")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "head-changed",
        message = "Refresh to see the latest publication."
    )]
    HeadChanged,
    /// Wait before requesting another link.
    #[error("[mkc-api/error] rate-limited")]
    #[rpc_error(
        code = "resource-exhausted",
        severity = "warn",
        reason = "rate-limited",
        message = "Wait before requesting another link.",
        data = "omit"
    )]
    RateLimited(i64),
    /// Please try again shortly.
    #[error("[mkc-api/error] unavailable")]
    #[rpc_error(
        code = "unavailable",
        reason = "unavailable",
        message = "Please try again shortly."
    )]
    Unavailable,
    /// Open the existing project.
    #[error("[mkc-api/error] duplicate-project")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "duplicate-project",
        message = "Open the existing project."
    )]
    DuplicateProject(DuplicateProject),
    /// Upgrade to Team to use this feature.
    #[error("[mkc-api/error] plan-required")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "plan-required",
        message = "Upgrade to Team to use this feature."
    )]
    PlanRequired(PlanRequired),
    /// Cancel the subscription in billing before continuing.
    #[error("[mkc-api/error] subscription-active")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "subscription-active",
        message = "Cancel the subscription in billing before continuing."
    )]
    SubscriptionActive,
    /// Choose another address.
    #[error("[mkc-api/error] slug-taken")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "slug-taken",
        message = "Choose another address."
    )]
    SlugTaken(SlugConflict),
    /// Choose another address.
    #[error("[mkc-api/error] slug-reserved")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "slug-reserved",
        message = "Choose another address."
    )]
    SlugReserved(SlugConflict),
    /// Assign another owner before continuing.
    #[error("[mkc-api/error] last-owner")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "last-owner",
        message = "Assign another owner before continuing."
    )]
    LastOwner,
    /// Refresh the page and try again.
    #[error("[mkc-api/error] csrf-rejected")]
    #[rpc_error(
        code = "permission-denied",
        severity = "warn",
        reason = "csrf-rejected",
        message = "Refresh the page and try again."
    )]
    CsrfRejected,
    /// Start desktop sign-in again.
    #[error("[mkc-api/error] desktop-grant-invalid")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "desktop-grant-invalid",
        message = "Start desktop sign-in again."
    )]
    DesktopGrantInvalid,
    /// Request a new sign-in link.
    #[error("[mkc-api/error] magic-link-invalid")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "magic-link-invalid",
        message = "Request a new sign-in link."
    )]
    MagicLinkInvalid,
    /// Request a new sign-in link.
    #[error("[mkc-api/error] magic-link-expired")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "magic-link-expired",
        message = "Request a new sign-in link."
    )]
    MagicLinkExpired,
    /// Request a new sign-in link.
    #[error("[mkc-api/error] magic-link-used")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "magic-link-used",
        message = "Request a new sign-in link."
    )]
    MagicLinkUsed,
    /// Sign in to continue.
    #[error("[mkc-api/error] session-expired")]
    #[rpc_error(
        code = "unauthenticated",
        severity = "warn",
        reason = "session-expired",
        message = "Sign in to continue."
    )]
    SessionExpired,
    /// Create a new publishing token.
    #[error("[mkc-api/error] token-revoked")]
    #[rpc_error(
        code = "unauthenticated",
        severity = "warn",
        reason = "token-revoked",
        message = "Create a new publishing token."
    )]
    TokenRevoked,
    /// Ask for a new invitation.
    #[error("[mkc-api/error] invitation-expired")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "invitation-expired",
        message = "Ask for a new invitation."
    )]
    InvitationExpired,
    /// This person already has access or an invitation.
    #[error("[mkc-api/error] already-member")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "already-member",
        message = "This person already has access or an invitation."
    )]
    AlreadyMember,
    /// This action is not available yet.
    #[error("[mkc-api/error] operation-unavailable")]
    #[rpc_error(
        code = "unavailable",
        reason = "operation-unavailable",
        message = "This action is not available yet."
    )]
    OperationUnavailable,
    /// Database migrations must finish before this process serves requests.
    #[error("[mkc-api/error] migrations-pending")]
    #[rpc_error(
        code = "unavailable",
        reason = "migrations-pending",
        message = "Please try again shortly."
    )]
    MigrationsPending,
    /// This action is unavailable.
    #[error("[mkc-api/error] method-not-allowed")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "method-not-allowed",
        message = "This action is unavailable."
    )]
    MethodNotAllowed,
    /// Send a smaller request.
    #[error("[mkc-api/error] payload-too-large")]
    #[rpc_error(
        code = "payload-too-large",
        severity = "warn",
        reason = "payload-too-large",
        message = "Send a smaller request."
    )]
    PayloadTooLarge,
    /// Please try again shortly.
    #[error("[mkc-api/error] internal: {0:?}")]
    #[rpc_error(
        code = "internal",
        reason = "internal-error",
        message = "Please try again shortly."
    )]
    Internal(#[from] InternalError),
    /// Choose a valid comment location.
    #[error("[mkc-api/error] invalid-anchor")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "invalid-anchor",
        message = "Choose a valid comment location."
    )]
    InvalidAnchor,
    /// Open the current review.
    #[error("[mkc-api/error] review-closed")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "review-closed",
        message = "Open the current review."
    )]
    ReviewClosed,
}

/// Result at the HTTP dispatch boundary.
pub type Result<T> = result::Result<T, ApiError>;
