//! Validation and delivery of authenticated prop render requests.

use axum::body::to_bytes;
use axum::extract::Request;
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::Response;

use crate::application::Application;
use crate::json_delivery::JsonBody;
use crate::preview::Lookup;
use crate::render_request::{self, Rejection, RenderRequest};
use crate::snapshot;
use crate::{response, security};

/// Serve a resource from one temporary preview bundle.
pub(crate) async fn file(app: &Application, rest: &str, headers: &HeaderMap) -> Response {
    let Some((id, path)) = rest.split_once('/') else {
        return response::missing();
    };
    match app.previews.get(id, path) {
        Lookup::File(file) if response::is_json(&file.content_type) => {
            JsonBody::Whole(file.bytes)
                .temporary_response(headers)
                .await
        }
        Lookup::File(file) => response::bytes(StatusCode::OK, &file.content_type, file.bytes),
        Lookup::Expired => response::error(
            StatusCode::GONE,
            "expired",
            "The temporary preview expired. Try again.",
        ),
        Lookup::Missing => response::missing(),
    }
}

/// Render one temporary document after authenticating and validating its request.
pub(crate) async fn render(app: &Application, request: Request) -> Response {
    if request.method() != Method::POST {
        return response::method("POST");
    }
    let render_token = app.publications.current().render_token.clone();
    if !security::authorized(request.headers(), &render_token) {
        return response::error(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Reload the catalogue to continue editing.",
        );
    }
    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !matches!(
        content_type,
        "application/json" | "application/json; charset=utf-8"
    ) {
        return response::reject(Rejection::InvalidInput);
    }
    let bytes = match to_bytes(request.into_body(), 64 * 1024).await {
        Ok(bytes) => bytes,
        Err(_) => {
            return response::error(
                StatusCode::PAYLOAD_TOO_LARGE,
                "too-large",
                "The prop values are too large.",
            );
        }
    };
    let request: RenderRequest = match serde_json::from_slice(&bytes) {
        Ok(request) => request,
        Err(_) => return response::reject(Rejection::InvalidInput),
    };
    let snapshot = app.publications.current();
    let validated = match render_request::validate_prepared(
        &request,
        &snapshot.index,
        &snapshot.prop_validators,
    ) {
        Ok(validated) => validated,
        Err(rejection) => return response::reject(rejection),
    };
    let result = app
        .work
        .preview(
            snapshot.documents.clone(),
            request.page_id,
            validated.route,
            validated.props.clone(),
            snapshot.lease.clone(),
        )
        .await;
    if app.publications.current().index.revision != snapshot.index.revision
        || app.publications.current().index.deployment_id != snapshot.index.deployment_id
    {
        return response::reject(Rejection::StaleRevision);
    }
    match result {
        Ok(preview) => match app
            .previews
            .insert(preview, &validated.props, request.revision)
        {
            Ok(response) => {
                let file = snapshot::encode(&response);
                response::bytes(StatusCode::OK, &file.content_type, file.bytes)
            }
            Err(rejection) => response::reject(rejection),
        },
        Err(rejection) => response::reject(rejection),
    }
}
