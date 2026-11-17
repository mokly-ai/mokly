//! Tokens operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::payload::Page;
use crate::views::tokens::{TokenCreated, TokenView};

use super::aliases::CreateToken;
use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(list_tokens, create_token, revoke_token))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/tokens",
    operation_id = "listTokens",
    tag = "Workspace",
    summary = "List publishing-token metadata without secrets.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<TokenView>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn list_tokens() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/tokens",
    operation_id = "createToken",
    tag = "Workspace",
    summary = "Create a publishing token and reveal it once.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = CreateToken, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = TokenCreated, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn create_token() {}

#[utoipa::path(
    delete,
    path = "/v1/projects/{projectId}/tokens/{tokenId}",
    operation_id = "revokeToken",
    tag = "Workspace",
    summary = "Revoke a publishing token.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("tokenId" = String, Path, format = "uuid"),
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
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn revoke_token() {}
