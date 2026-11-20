//! GitHub reasons delegated by the single API error boundary.

use thiserror::Error;

use crate::error::ApiError;

/// GitHub-specific client-safe reasons.
#[derive(Debug, Error, rpc_error::RpcError)]
pub enum GitHubError {
    /// Start GitHub sign-in again.
    #[error("[mkc-api/github_error] github-auth-invalid")]
    #[rpc_error(
        code = "bad-request",
        severity = "warn",
        reason = "github-auth-invalid",
        message = "Start GitHub sign-in again."
    )]
    AuthInvalid,
    /// Verify your primary email on GitHub or sign in by email.
    #[error("[mkc-api/github_error] github-email-unverified")]
    #[rpc_error(
        code = "permission-denied",
        severity = "warn",
        reason = "github-email-unverified",
        message = "Verify your primary email on GitHub or sign in by email."
    )]
    EmailUnverified,
    /// Use the GitHub account linked to your email.
    #[error("[mkc-api/github_error] github-identity-conflict")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "github-identity-conflict",
        message = "Use the GitHub account linked to your email."
    )]
    IdentityConflict,
    /// Installation already belongs to another workspace.
    #[error("[mkc-api/github_error] github-installation-conflict")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "github-installation-conflict",
        message = "Installation already belongs to another workspace."
    )]
    InstallationConflict,
    /// The webhook delivery could not be authenticated.
    #[error("[mkc-api/github_error] webhook-signature-invalid")]
    #[rpc_error(
        code = "unauthenticated",
        severity = "warn",
        reason = "webhook-signature-invalid",
        message = "The webhook delivery could not be authenticated."
    )]
    WebhookSignatureInvalid,
}

impl ApiError {
    /// Start GitHub sign-in again.
    pub(crate) const GITHUB_AUTH_INVALID: Self = Self::GitHub(GitHubError::AuthInvalid);
    /// Verify your primary email on GitHub or sign in by email.
    pub(crate) const GITHUB_EMAIL_UNVERIFIED: Self = Self::GitHub(GitHubError::EmailUnverified);
    /// Use the GitHub account linked to your email.
    pub(crate) const GITHUB_IDENTITY_CONFLICT: Self = Self::GitHub(GitHubError::IdentityConflict);
    /// Installation already belongs to another workspace.
    pub(crate) const GITHUB_INSTALLATION_CONFLICT: Self =
        Self::GitHub(GitHubError::InstallationConflict);
    /// The webhook delivery could not be authenticated.
    pub(crate) const WEBHOOK_SIGNATURE_INVALID: Self =
        Self::GitHub(GitHubError::WebhookSignatureInvalid);
}
