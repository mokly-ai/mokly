//! Projects operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use utoipa::OpenApi;

use crate::input::{CreateProject, Delete, UpdateProject};
use crate::payload::Page;
use crate::views::projects::{ProjectSlugLookupView, ProjectSlugSuggestionView, ProjectView};

use super::parameter_schemas::ConfigPath;
use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    get_project_by_slug,
    list_projects,
    create_project,
    suggest_project_slug,
    get_project,
    update_project,
    delete_project
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/workspaces/by-slug/{workspaceSlug}/projects/{projectSlug}",
    operation_id = "getProjectBySlug",
    tag = "Workspace",
    summary = "Read a project by its current or retired workspace and project slugs.",
    params(
        ("workspaceSlug" = WorkspaceSlug, Path),
        ("projectSlug" = ProjectSlug, Path),
    ),
    responses(
        (status = 200, description = "The project with the current project and workspace slugs.", body = ProjectSlugLookupView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security((), ("session" = [])),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_project_by_slug() {}

#[utoipa::path(
    get,
    path = "/v1/workspaces/{workspaceId}/projects",
    operation_id = "listProjects",
    tag = "Workspace",
    summary = "List accessible projects.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<ProjectView>, content_type = "application/json"),
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
fn list_projects() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces/{workspaceId}/projects",
    operation_id = "createProject",
    tag = "Workspace",
    summary = "Create a repository and config-path project.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = CreateProject, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = ProjectView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::DUPLICATE_PROJECT,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::SLUG_TAKEN,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn create_project() {}

#[utoipa::path(
    get,
    path = "/v1/workspaces/{workspaceId}/projects/slug-suggestion",
    operation_id = "suggestProjectSlug",
    tag = "Workspace",
    summary = "Suggest an available project slug without reserving it.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        ("repository" = String, Query, pattern = "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"),
        ("configPath" = inline(ConfigPath), Query),
    ),
    responses(
        (status = 200, description = "A valid suggestion that was available when read.", body = ProjectSlugSuggestionView, content_type = "application/json"),
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
fn suggest_project_slug() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}",
    operation_id = "getProject",
    tag = "Workspace",
    summary = "Read a project and administrative permissions.",
    params(
        ("projectId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = ProjectView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security((), ("session" = [])),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_project() {}

#[utoipa::path(
    patch,
    path = "/v1/projects/{projectId}",
    operation_id = "updateProject",
    tag = "Workspace",
    summary = "Update project settings and Automatic builds.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = UpdateProject, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = ProjectView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::BUILDS_UNAVAILABLE,
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::PLAN_REQUIRED,
        reasons::SESSION_EXPIRED,
        reasons::SLUG_TAKEN,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn update_project() {}

#[utoipa::path(
    delete,
    path = "/v1/projects/{projectId}",
    operation_id = "deleteProject",
    tag = "Workspace",
    summary = "Delete a project after name confirmation.",
    params(
        ("projectId" = String, Path, format = "uuid"),
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
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn delete_project() {}
