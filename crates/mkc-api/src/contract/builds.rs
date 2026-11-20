//! Cloud build operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::builds::history::HistoryEntry;
use crate::builds::input::{LogQuery, Reference};
use crate::builds::views::{Build, Log};
use crate::payload::Page;

use super::parameter_schemas::PositiveInteger;
use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(list_history, request_build, get_build, list_build_log, cancel_build))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/history",
    operation_id = "listHistory",
    tag = "Workspace",
    summary = "Read publication and build history.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("branch" = Option<String>, Query, nullable = false, min_length = 1, max_length = 2048),
        ("pullRequest" = inline(Option<PositiveInteger>), Query, nullable = false, minimum = 1),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Newest-first history page.", body = Page<HistoryEntry>, content_type = "application/json"),
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
fn list_history() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/builds",
    operation_id = "requestBuild",
    tag = "Workspace",
    summary = "Publish the current branch or pull request head.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Reference, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = Build, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::BUILD_ALREADY_ACTIVE,
        reasons::BUILD_ALREADY_PUBLISHED,
        reasons::BUILD_INELIGIBLE,
        reasons::BUILDS_UNAVAILABLE,
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::PLAN_REQUIRED,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::UNAVAILABLE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn request_build() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/builds/{buildId}",
    operation_id = "getBuild",
    tag = "Workspace",
    summary = "Read a member-only build.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("buildId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Build, content_type = "application/json"),
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
fn get_build() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/builds/{buildId}/log",
    operation_id = "listBuildLog",
    tag = "Workspace",
    summary = "Read a member-only log window.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("buildId" = String, Path, format = "uuid"),
        LogQuery,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Log, content_type = "application/json"),
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
fn list_build_log() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/builds/{buildId}/cancel",
    operation_id = "cancelBuild",
    tag = "Workspace",
    summary = "Cancel an active build or return its current state.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("buildId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Build, content_type = "application/json"),
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
fn cancel_build() {}
