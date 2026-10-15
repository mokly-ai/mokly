//! HTTP route dispatch over an atomic publication and injected runtime services.

use std::sync::Arc;

use async_trait::async_trait;
use axum::body::{Body, to_bytes};
use axum::extract::{Request, State};
use axum::http::{HeaderValue, Method, StatusCode};
use axum::response::Response;
use axum::{Router, routing};
use mokly_model::namespace::{generated, viewer};
use mokly_model::paths::is_entry_path;
use tokio::sync::watch;

use crate::diagnostics::Diagnostics;
use crate::preview::{Lookup, PreviewStore};
use crate::publication::Publications;
use crate::render_request::{Rejection, RenderRequest};
use crate::snapshot::Snapshot;
use crate::work::Work;
use crate::{live, render_request, response, security};

/// Application services are independent of socket and signal ownership.
pub struct Application {
    /// One atomic source for every route and event.
    pub publications: Arc<dyn Publications>,
    /// Isolated bounded temporary documents.
    pub previews: Arc<dyn PreviewStore>,
    pub(crate) diagnostics: Arc<dyn Diagnostics>,
    pub(crate) work: Arc<dyn Work>,
}
impl Application {
    /// Build an application around injected document and preview services.
    pub fn new(
        publications: Arc<dyn Publications>,
        previews: Arc<dyn PreviewStore>,
        work: Arc<dyn Work>,
        diagnostics: Arc<dyn Diagnostics>,
    ) -> Self {
        Self {
            publications,
            previews,
            work,
            diagnostics,
        }
    }
}

/// HTTP application boundary consumed by the socket runtime.
#[async_trait]
pub trait HttpApplication: Send + Sync {
    /// Build request dispatch over this application's injected services.
    fn router(self: Arc<Self>, stop: watch::Receiver<bool>) -> Router;
    /// Stop admission, drain render work, and release temporary bytes.
    async fn stop_renders(&self);
}

#[async_trait]
impl HttpApplication for Application {
    fn router(self: Arc<Self>, stop: watch::Receiver<bool>) -> Router {
        Router::new()
            .fallback(routing::any(dispatch))
            .with_state((self, stop))
    }
    async fn stop_renders(&self) {
        self.work.stop().await;
        self.previews.clear();
    }
}

async fn dispatch(
    State((app, stop)): State<(Arc<Application>, watch::Receiver<bool>)>,
    request: Request,
) -> Response {
    let head = request.method() == Method::HEAD;
    let mut result = route(&app, request, stop).await;
    if head {
        *result.body_mut() = Body::empty();
    }
    result
}

async fn route(app: &Application, request: Request, stop: watch::Receiver<bool>) -> Response {
    if security::host(request.headers()).is_none() {
        return response::error(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Use the local catalogue address.",
        );
    }
    if request.uri().scheme().is_some() || request.uri().authority().is_some() {
        return response::missing();
    }
    let Some(path) = security::decode(request.uri().path()) else {
        return response::missing();
    };
    let snapshot = app.publications.current();
    if path == viewer("components/render") {
        if request.method() != Method::POST {
            return method("POST");
        }
        if !security::authorized(request.headers(), &snapshot.render_token) {
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
            return reject(Rejection::InvalidInput);
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
            Err(_) => return reject(Rejection::InvalidInput),
        };
        let validated = match render_request::validate(&request, &snapshot.index) {
            Ok(validated) => validated,
            Err(rejection) => return reject(rejection),
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
            return reject(Rejection::StaleRevision);
        }
        return match result {
            Ok(preview) => match app
                .previews
                .insert(preview, &validated.props, request.revision)
            {
                Ok(response) => match crate::snapshot::encode(&response) {
                    Ok(file) => response::bytes(StatusCode::OK, &file.content_type, file.bytes),
                    Err(_) => reject(Rejection::RenderFailed),
                },
                Err(rejection) => reject(rejection),
            },
            Err(rejection) => reject(rejection),
        };
    }
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return method("GET, HEAD");
    }
    if path == viewer("events") {
        if request.method() == Method::HEAD {
            return response::bytes(StatusCode::OK, "text/event-stream", Vec::new());
        }
        return live::events(app.publications.subscribe(), stop);
    }
    if let Some(rest) = path.strip_prefix(&viewer("components/renders/")) {
        let Some((id, file)) = rest.split_once('/') else {
            return response::missing();
        };
        return match app.previews.get(id, file) {
            Lookup::File(file) => response::bytes(StatusCode::OK, &file.content_type, file.bytes),
            Lookup::Expired => response::error(
                StatusCode::GONE,
                "expired",
                "The temporary preview expired. Try again.",
            ),
            Lookup::Missing => response::missing(),
        };
    }
    if path.is_empty() || path == "404.html" || shell(&path, &snapshot) {
        return response::bytes(
            StatusCode::OK,
            "text/html; charset=utf-8",
            snapshot.stub.clone(),
        );
    }
    if let Some(file) = snapshot.files.get(&path) {
        return response::bytes(StatusCode::OK, &file.content_type, file.bytes.clone());
    }
    if let Some(route) = path.strip_prefix(&generated("")) {
        return match app
            .work
            .generated(snapshot.documents.clone(), route.into())
            .await
        {
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
        };
    }
    if let Some(path) = path.strip_prefix("static/")
        && let Some(file) = app
            .work
            .authored(snapshot.documents.clone(), path.into())
            .await
    {
        return response::bytes(StatusCode::OK, &file.content_type, file.bytes);
    }
    response::missing()
}

fn shell(path: &str, snapshot: &Snapshot) -> bool {
    let Some(path) = path.strip_prefix("view/") else {
        return false;
    };
    let path = path
        .strip_suffix("/index.html")
        .or_else(|| path.strip_suffix('/'))
        .unwrap_or(path);
    is_entry_path(path) && snapshot.entries.contains(path)
}
fn method(allow: &'static str) -> Response {
    let mut response = response::error(
        StatusCode::METHOD_NOT_ALLOWED,
        "method",
        "The request method is not supported.",
    );
    response
        .headers_mut()
        .insert("allow", HeaderValue::from_static(allow));
    response
}
fn reject(rejection: Rejection) -> Response {
    let (status, code, message) = match rejection {
        Rejection::InvalidInput => (
            StatusCode::BAD_REQUEST,
            "invalid-input",
            "Check the prop values and their allowed limits.",
        ),
        Rejection::UnknownEntry => (
            StatusCode::NOT_FOUND,
            "unknown-entry",
            "This entry is unavailable.",
        ),
        Rejection::StaleRevision => (
            StatusCode::CONFLICT,
            "stale-revision",
            "The catalogue changed. Try again.",
        ),
        Rejection::RenderFailed => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "render-failed",
            "The preview could not be rendered. Try again or reset the props.",
        ),
        Rejection::Capacity => (
            StatusCode::TOO_MANY_REQUESTS,
            "capacity",
            "The renderer is busy. Try again shortly.",
        ),
    };
    response::error(status, code, message)
}
