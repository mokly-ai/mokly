//! The project WebSocket operation and its message components.

#![expect(
    dead_code,
    reason = "The WebSocket handler serves the documented operation."
)]

use mkc_live_interface::messages::ServerMessage;
use utoipa::OpenApi;

use super::parameters::Origin;
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(open_live_channel), components(schemas(ServerMessage)))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/live/projects/{projectId}",
    operation_id = "openLiveChannel",
    tag = "Workspace",
    summary = "Open a project WebSocket for a signed-in member.",
    params(("projectId" = String, Path, format = "uuid"), Origin),
    responses(
        (status = 101, description = "Switching Protocols. The WebSocket sends ServerMessage objects in text frames."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn open_live_channel() {}
