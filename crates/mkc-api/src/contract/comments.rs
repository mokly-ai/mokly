//! Comments operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use mkc_domain::entry_path::EntryPath;
use utoipa::OpenApi;

use crate::payload::Page;

use super::deferred::comment_input::{
    CreateThread, DeleteComment, Reply, ResolveThread, UpdateComment,
};
use super::deferred::comments::{Comment, Thread};
use super::parameter_schemas::{ColorScheme, ThreadCurrency, ThreadState, ThreadViewport};
use super::parameters::{Csrf, Cursor, Idempotency, Limit};
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    list_threads,
    create_thread,
    get_thread,
    resolve_thread,
    reply_to_thread,
    edit_comment,
    delete_comment
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/projects/{projectId}/publications/{publicationId}/threads",
    operation_id = "listThreads",
    tag = "Review",
    summary = "List threads carried to the selected publication.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
        ("screenPath" = Option<EntryPath>, Query, nullable = false),
        ("state" = inline(Option<ThreadState>), Query, nullable = false),
        ("currency" = inline(Option<ThreadCurrency>), Query, nullable = false),
        Cursor,
        Limit,
        ("viewport" = inline(Option<ThreadViewport>), Query, nullable = false),
        ("scheme" = inline(Option<ColorScheme>), Query, nullable = false),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<Thread>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn list_threads() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/threads",
    operation_id = "createThread",
    tag = "Review",
    summary = "Create a screen-anchored thread.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        Csrf,
        Idempotency,
    ),
    request_body(content = CreateThread, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = Thread, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn create_thread() {}

#[utoipa::path(
    get,
    path = "/v1/threads/{threadId}",
    operation_id = "getThread",
    tag = "Review",
    summary = "Read a thread and original anchor.",
    params(
        ("threadId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Thread, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn get_thread() {}

#[utoipa::path(
    patch,
    path = "/v1/threads/{threadId}",
    operation_id = "resolveThread",
    tag = "Review",
    summary = "Resolve or reopen at the expected version.",
    params(
        ("threadId" = String, Path, format = "uuid"),
        Csrf,
    ),
    request_body(content = ResolveThread, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Thread, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn resolve_thread() {}

#[utoipa::path(
    post,
    path = "/v1/threads/{threadId}/comments",
    operation_id = "replyToThread",
    tag = "Review",
    summary = "Reply to an existing thread.",
    params(
        ("threadId" = String, Path, format = "uuid"),
        Csrf,
        Idempotency,
    ),
    request_body(content = Reply, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = Comment, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn reply_to_thread() {}

#[utoipa::path(
    patch,
    path = "/v1/comments/{commentId}",
    operation_id = "editComment",
    tag = "Review",
    summary = "Edit an authorized comment at the expected version.",
    params(
        ("commentId" = String, Path, format = "uuid"),
        Csrf,
    ),
    request_body(content = UpdateComment, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = Comment, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn edit_comment() {}

#[utoipa::path(
    delete,
    path = "/v1/comments/{commentId}",
    operation_id = "deleteComment",
    tag = "Review",
    summary = "Delete an authorized comment with an audit tombstone.",
    params(
        ("commentId" = String, Path, format = "uuid"),
        Csrf,
    ),
    request_body(content = inline(DeleteComment), content_type = "application/json"),
    responses(
        (status = 204, description = "Successful operation."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn delete_comment() {}
