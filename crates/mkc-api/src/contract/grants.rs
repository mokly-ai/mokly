//! Grants operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::input::{CreateGrant, Version};
use crate::payload::Page;
use crate::views::grants::GrantView;

use super::aliases::UpdateGrant;
use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    list_project_grants,
    create_project_grant,
    update_project_grant,
    remove_project_grant
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/members",
    operation_id = "listProjectGrants",
    tag = "Workspace",
    summary = "List inherited and project-specific access.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<GrantView>, content_type = "application/json"),
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
fn list_project_grants() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/members",
    operation_id = "createProjectGrant",
    tag = "Workspace",
    summary = "Grant an existing user project access.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = CreateGrant, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = GrantView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::ALREADY_MEMBER,
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
fn create_project_grant() {}

#[utoipa::path(
    patch,
    path = "/v1/projects/{projectId}/members/{grantId}",
    operation_id = "updateProjectGrant",
    tag = "Workspace",
    summary = "Update a direct project grant.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("grantId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = UpdateGrant, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = GrantView, content_type = "application/json"),
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
        reasons::VERSION_CONFLICT,
    ])))
)]
fn update_project_grant() {}

#[utoipa::path(
    delete,
    path = "/v1/projects/{projectId}/members/{grantId}",
    operation_id = "removeProjectGrant",
    tag = "Workspace",
    summary = "Remove a direct project grant; inherited access remains.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("grantId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Version, content_type = "application/json"),
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
        reasons::VERSION_CONFLICT,
    ])))
)]
fn remove_project_grant() {}
