//! Publications operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use mkc_domain::entry_path::EntryPath;
use utoipa::OpenApi;

use crate::payload::Page;
use crate::viewer::views::{Branch, Publication, PullRequest, Screen, ShareLink};

use super::parameter_schemas::{ColorScheme, PositiveInteger, ShareViewport};
use super::parameters::{Cursor, Limit};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    list_branches,
    list_pull_requests,
    list_publications,
    get_publication,
    list_screens,
    get_share_link
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/branches",
    operation_id = "listBranches",
    tag = "Workspace",
    summary = "List branches with newest attempts and latest ready publication IDs.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Branch>, content_type = "application/json"),
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
fn list_branches() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/pull-requests",
    operation_id = "listPullRequests",
    tag = "Workspace",
    summary = "List pull requests with newest attempts and latest ready publication IDs.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<PullRequest>, content_type = "application/json"),
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
fn list_pull_requests() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/publications",
    operation_id = "listPublications",
    tag = "Workspace",
    summary = "List publication history, optionally filtered by branch or PR.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("branch" = Option<String>, Query, nullable = false),
        ("pullRequest" = inline(Option<PositiveInteger>), Query, nullable = false, minimum = 1),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Publication>, content_type = "application/json"),
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
fn list_publications() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/publications/{publicationId}",
    operation_id = "getPublication",
    tag = "Workspace",
    summary = "Read immutable publication context.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Publication, content_type = "application/json"),
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
fn get_publication() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/publications/{publicationId}/screens",
    operation_id = "listScreens",
    tag = "Workspace",
    summary = "List validated current screen paths and views.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Screen>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security((), ("session" = [])),
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
fn list_screens() {}

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/publications/{publicationId}/share",
    operation_id = "getShareLink",
    tag = "Workspace",
    summary = "Return a canonical link without granting access.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
        ("catalogueScreen" = Option<EntryPath>, Query, nullable = false, description = "Current entry path, at most 2048 UTF-8 bytes after one URL decode. Preserve case. Refuse device names and a first segment of mokly-generated."),
        ("viewport" = inline(Option<ShareViewport>), Query, nullable = false),
        ("scheme" = inline(Option<ColorScheme>), Query, nullable = false),
        ("thread" = Option<String>, Query, nullable = false, description = "Reserved; returns `validation-failed` until comments ship."),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = ShareLink, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security((), ("session" = [])),
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
fn get_share_link() {}
