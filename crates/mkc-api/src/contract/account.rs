//! Account operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::input::{MagicLink, Name, PreviewCredential, VerifyLink};
use crate::views::account::{MagicLinkView, SessionIssuedView, SessionView, UserView};

use super::error::Error;
use super::parameter_schemas::PositiveInteger;
use super::parameters::{Csrf, Origin};
use super::reasons;
use super::responses::ErrorResponse;

mod desktop_grant;

#[derive(OpenApi)]
#[openapi(paths(
    get_session,
    sign_out,
    rotate_session,
    send_magic_link,
    verify_preview_sign_in,
    verify_magic_link,
    desktop_grant::issue,
    desktop_grant::exchange,
    update_account
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/session",
    operation_id = "getSession",
    tag = "Account",
    summary = "Read the current user and permissions.",
    responses(
        (status = 200, description = "Successful operation.", body = SessionView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_session() {}

#[utoipa::path(
    delete,
    path = "/v1/session",
    operation_id = "signOut",
    tag = "Account",
    summary = "End the current session.",
    params(
        Csrf,
        Origin,
    ),
    responses(
        (status = 204, description = "Successful operation.",
            headers(
                ("Set-Cookie" = String),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn sign_out() {}

#[utoipa::path(
    post,
    path = "/v1/session",
    operation_id = "rotateSession",
    tag = "Workspace",
    summary = "Rotate the session and CSRF credentials.",
    params(
        Csrf,
        Origin,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = SessionView, content_type = "application/json",
            headers(
                ("Set-Cookie" = String),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn rotate_session() {}

#[utoipa::path(
    post,
    path = "/v1/auth/magic-links",
    operation_id = "sendMagicLink",
    tag = "Account",
    summary = "Send a sign-in link without revealing account existence.",
    params(
        Origin,
    ),
    request_body(content = MagicLink, content_type = "application/json"),
    responses(
        (status = 202, description = "Successful operation.", body = MagicLinkView, content_type = "application/json"),
        (status = 429, description = "Persistent email or peer admission limit reached.", body = Error, content_type = "application/json",
            headers(
                ("Retry-After" = inline(PositiveInteger), description = "Seconds until another request can be admitted."),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn send_magic_link() {}

#[utoipa::path(
    post,
    path = "/v1/auth/preview",
    operation_id = "verifyPreviewSignIn",
    tag = "Account",
    summary = "Exchange the preview password for a session cookie.",
    params(
        Origin,
    ),
    request_body(content = PreviewCredential, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = SessionIssuedView, content_type = "application/json",
            headers(
                ("Set-Cookie" = String),
            )
        ),
        (status = 429, description = "Persistent peer admission limit reached.", body = Error, content_type = "application/json",
            headers(
                ("Retry-After" = inline(PositiveInteger), description = "Seconds until another request can be admitted."),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::MAGIC_LINK_INVALID,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn verify_preview_sign_in() {}

#[utoipa::path(
    post,
    path = "/v1/auth/callback",
    operation_id = "verifyMagicLink",
    tag = "Account",
    summary = "Consume a magic link and issue a session cookie.",
    params(
        Origin,
    ),
    request_body(content = VerifyLink, content_type = "application/json"),
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
        reasons::INTERNAL_ERROR,
        reasons::MAGIC_LINK_EXPIRED,
        reasons::MAGIC_LINK_INVALID,
        reasons::MAGIC_LINK_USED,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn verify_magic_link() {}

#[utoipa::path(
    patch,
    path = "/v1/account",
    operation_id = "updateAccount",
    tag = "Workspace",
    summary = "Update your display name.",
    params(
        Csrf,
        Origin,
    ),
    request_body(content = Name, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = UserView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn update_account() {}
