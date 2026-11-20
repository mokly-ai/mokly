//! Workspaces operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use mkc_domain::slug::WorkspaceSlug;
use utoipa::OpenApi;

use crate::input::{CreateWorkspace, Delete, Rename};
use crate::payload::Page;
use crate::views::workspaces::{
    WorkspaceSlugLookupView, WorkspaceSlugSuggestionView, WorkspaceView,
};

use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    list_workspaces,
    create_workspace,
    suggest_workspace_slug,
    get_workspace_by_slug,
    get_workspace,
    update_workspace,
    delete_workspace
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/workspaces",
    operation_id = "listWorkspaces",
    tag = "Workspace",
    summary = "List accessible workspaces.",
    params(
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<WorkspaceView>, content_type = "application/json"),
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
fn list_workspaces() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces",
    operation_id = "createWorkspace",
    tag = "Workspace",
    summary = "Create a personal workspace.",
    params(
        Csrf,
        Origin,
    ),
    request_body(content = CreateWorkspace, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = WorkspaceView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::SLUG_RESERVED,
        reasons::SLUG_TAKEN,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn create_workspace() {}

#[utoipa::path(
    get,
    path = "/v1/workspaces/slug-suggestion",
    operation_id = "suggestWorkspaceSlug",
    tag = "Workspace",
    summary = "Suggest an available workspace slug without reserving it.",
    params(
        ("name" = String, Query, min_length = 1, max_length = 80),
    ),
    responses(
        (status = 200, description = "A valid suggestion that was available when read.", body = WorkspaceSlugSuggestionView, content_type = "application/json"),
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
fn suggest_workspace_slug() {}

#[utoipa::path(
    get,
    path = "/v1/workspaces/by-slug/{workspaceSlug}",
    operation_id = "getWorkspaceBySlug",
    tag = "Workspace",
    summary = "Read an authorized workspace by its current or retired slug.",
    params(
        ("workspaceSlug" = WorkspaceSlug, Path),
    ),
    responses(
        (status = 200, description = "The workspace with its current slug repeated as canonicalSlug.", body = WorkspaceSlugLookupView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_workspace_by_slug() {}

#[utoipa::path(
    get,
    path = "/v1/workspaces/{workspaceId}",
    operation_id = "getWorkspace",
    tag = "Workspace",
    summary = "Read an authorized workspace.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = WorkspaceView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_workspace() {}

#[utoipa::path(
    patch,
    path = "/v1/workspaces/{workspaceId}",
    operation_id = "updateWorkspace",
    tag = "Workspace",
    summary = "Rename a workspace.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Rename, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = WorkspaceView, content_type = "application/json"),
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
        reasons::SLUG_RESERVED,
        reasons::SLUG_TAKEN,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn update_workspace() {}

#[utoipa::path(
    delete,
    path = "/v1/workspaces/{workspaceId}",
    operation_id = "deleteWorkspace",
    tag = "Workspace",
    summary = "Delete a workspace after name confirmation.",
    description = "A live subscription is canceled before deletion. Unconfigured billing returns `operation-unavailable`; a provider outage returns `unavailable` and leaves the workspace unchanged.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Delete, content_type = "application/json"),
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
        reasons::UNAVAILABLE,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn delete_workspace() {}
