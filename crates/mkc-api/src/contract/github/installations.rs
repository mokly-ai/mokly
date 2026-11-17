//! GitHub installations operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use crate::github::input::{Install, InstallationCallback};
use crate::github::views::{Connection, Installation, Repository};
use crate::payload::Page;

use super::super::parameters::{Csrf, Cursor, Limit, Origin};
use super::super::reasons;
use super::super::responses::ErrorResponse;

#[utoipa::path(
    post,
    path = "/v1/github/installations/callback",
    operation_id = "completeGitHubInstallation",
    tag = "GitHub",
    summary = "Authorize the installed GitHub account.",
    params(
        Csrf,
        Origin,
    ),
    request_body(content = InstallationCallback, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Connection, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::GITHUB_AUTH_INVALID,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn complete_github_installation() {}

#[utoipa::path(
    delete,
    path = "/v1/github/installations/{installationId}",
    operation_id = "disconnectGitHubInstallation",
    tag = "GitHub",
    summary = "Disconnect a workspace from GitHub.",
    params(
        ("installationId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    responses(
        (status = 204, description = "Successful operation."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn disconnect_github_installation() {}

#[utoipa::path(
    get,
    path = "/v1/github/installations",
    operation_id = "listInstallations",
    tag = "GitHub",
    summary = "List your connected App installations.",
    params(
        Cursor,
        Limit,
        ("workspaceId" = Option<String>, Query, format = "uuid", description = "Filter to a workspace you belong to."),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Installation>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn list_installations() {}

#[utoipa::path(
    post,
    path = "/v1/github/installations",
    operation_id = "installGitHubApp",
    tag = "GitHub",
    summary = "Install the App for your workspace.",
    params(
        Csrf,
        Origin,
    ),
    request_body(content = Install, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Connection, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn install_github_app() {}

#[utoipa::path(
    get,
    path = "/v1/github/installations/{installationId}/repositories",
    operation_id = "listRepositories",
    tag = "GitHub",
    summary = "List available installed repositories.",
    params(
        ("installationId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Repository>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn list_repositories() {}
