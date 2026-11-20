//! GitHub authentication operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use crate::github::input::{Callback, Start};
use crate::github::views::Connection;
use crate::views::account::SessionIssuedView;

use super::super::parameters::{Csrf, Origin};
use super::super::reasons;
use super::super::responses::ErrorResponse;

#[utoipa::path(
    post,
    path = "/v1/auth/github",
    operation_id = "startGitHubSignIn",
    tag = "GitHub",
    summary = "Sign in with GitHub.",
    params(
        Origin,
    ),
    request_body(content = Start, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Connection, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn start_github_sign_in() {}

#[utoipa::path(
    post,
    path = "/v1/auth/github/callback",
    operation_id = "verifyGitHubSignIn",
    tag = "GitHub",
    summary = "Complete GitHub sign-in or connection.",
    params(
        Origin,
        ("X-CSRF-Token" = Option<String>, Header, nullable = false, description = "Required for a flow started from an authenticated session."),
    ),
    request_body(content = Callback, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = SessionIssuedView, content_type = "application/json",
            headers(
                ("Set-Cookie" = String),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::GITHUB_AUTH_INVALID,
        reasons::GITHUB_EMAIL_UNVERIFIED,
        reasons::GITHUB_IDENTITY_CONFLICT,
        reasons::GITHUB_INSTALLATION_CONFLICT,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::UNAVAILABLE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn verify_github_sign_in() {}

#[utoipa::path(
    post,
    path = "/v1/github/connection",
    operation_id = "connectGitHub",
    tag = "GitHub",
    summary = "Connect your GitHub account.",
    params(
        Csrf,
        Origin,
    ),
    request_body(content = Start, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Connection, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn connect_github() {}

#[utoipa::path(
    delete,
    path = "/v1/github/connection",
    operation_id = "disconnectGitHub",
    tag = "GitHub",
    summary = "Disconnect your GitHub account.",
    params(
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
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn disconnect_github() {}
