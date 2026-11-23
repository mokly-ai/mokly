//! Generated resource delivery uses one pinned publication and the shared worker pool.

use std::sync::Arc;

use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;

use crate::application::Application;
use crate::asset_response;
use crate::snapshot::Snapshot;
use crate::{response, validator};

/// Deliver one declared asset or document without resolving a later publication.
pub(crate) async fn route(
    app: &Application,
    snapshot: &Arc<Snapshot>,
    route: &str,
    headers: &HeaderMap,
) -> Response {
    if route.starts_with("assets/") {
        return match app
            .work
            .asset(snapshot.documents.clone(), route.into())
            .await
        {
            Ok(Some(file)) => asset_response::deliver(file, headers).await,
            Ok(None) => response::missing(),
            Err(error) => {
                app.diagnostics.failed(&error);
                response::error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "render-failed",
                    "The asset could not be rendered. Try again.",
                )
            }
        };
    }
    if route.starts_with("styles/") {
        return match app
            .work
            .stylesheet(snapshot.documents.clone(), route.into())
            .await
        {
            Ok(Some(stylesheet)) => validator::deliver(headers, stylesheet.etag, || {
                let file = stylesheet.file;
                response::bytes(StatusCode::OK, &file.content_type, file.bytes)
            }),
            Ok(None) => response::missing(),
            Err(error) => {
                app.diagnostics.failed(&error);
                response::error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "render-failed",
                    "The document could not be rendered. Try again.",
                )
            }
        };
    }

    let result = app
        .work
        .generated(snapshot.documents.clone(), route.into())
        .await;
    app.publisher.completed(snapshot.clone(), route.into());
    match result {
        Ok(Some(file)) => response::bytes(StatusCode::OK, &file.content_type, file.bytes),
        Ok(None) => response::missing(),
        Err(error) => {
            app.diagnostics.failed(&error);
            response::error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "render-failed",
                "The document could not be rendered. Try again.",
            )
        }
    }
}
