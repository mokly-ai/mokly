//! HTTP route dispatch over an atomic publication and injected runtime services.

use std::io;
use std::sync::Arc;

use async_trait::async_trait;
use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::{Method, StatusCode};
use axum::response::Response;
use axum::{Router, routing};
use mokly_model::namespace::{generated, viewer};
use mokly_model::paths::is_entry_path;
use tokio::sync::watch;

use crate::application_evidence::{CompletionQueue, EvidencePublisher};
use crate::diagnostics::Diagnostics;
use crate::json_delivery::JsonBody;
use crate::preview::PreviewStore;
use crate::publication::Publications;
use crate::snapshot::Snapshot;
use crate::work::Work;
use crate::{
    asset_response, comparison_routes, generated_routes, live, preview_route, response, security,
};

/// Application services are independent of socket and signal ownership.
pub struct Application {
    /// Retained Changes and on-demand comparison generations.
    pub comparisons: Option<Arc<dyn crate::comparison_store::Comparisons>>,
    /// One atomic source for every route and event.
    pub publications: Arc<dyn Publications>,
    /// Isolated bounded temporary documents.
    pub previews: Arc<dyn PreviewStore>,
    pub(crate) diagnostics: Arc<dyn Diagnostics>,
    pub(crate) work: Arc<dyn Work>,
    pub(crate) publisher: Arc<dyn EvidencePublisher>,
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
            comparisons: None,
            publisher: Arc::new(CompletionQueue::new(
                publications.clone(),
                diagnostics.clone(),
            )),
            publications,
            previews,
            work,
            diagnostics,
        }
    }
}

/// HTTP application boundary consumed by the socket runtime.
#[cfg_attr(test, unimock::unimock(api = HttpApplicationMock))]
#[async_trait]
pub trait HttpApplication: Send + Sync {
    /// Build request dispatch over this application's injected services.
    fn router(self: Arc<Self>, stop: watch::Receiver<bool>) -> Router;
    /// Stop admission, drain render work, and release temporary bytes.
    async fn stop_renders(&self);
    /// Send accept backoff diagnostics to the application reporter.
    fn accept_failed(&self, error: &io::Error);
    /// Send accept recovery diagnostics to the application reporter.
    fn accept_recovered(&self);
}

#[async_trait]
impl HttpApplication for Application {
    fn accept_failed(&self, error: &io::Error) {
        self.diagnostics.accept_failed(error);
    }
    fn accept_recovered(&self) {
        self.diagnostics.accept_recovered();
    }
    fn router(self: Arc<Self>, stop: watch::Receiver<bool>) -> Router {
        Router::new()
            .fallback(routing::any(dispatch))
            .with_state((self, stop))
    }
    async fn stop_renders(&self) {
        self.publisher.close().await;
        self.work.stop().await;
        if let Some(comparisons) = &self.comparisons {
            comparisons.stop().await;
        }
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
    if path == viewer("components/render") {
        return preview_route::render(app, request).await;
    }
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return response::method("GET, HEAD");
    }
    if path == viewer("events") {
        if request.method() == Method::HEAD {
            return response::bytes(StatusCode::OK, "text/event-stream", Bytes::new());
        }
        return live::events(app.publications.subscribe(), stop);
    }
    if let Some(rest) = path.strip_prefix(&viewer("components/renders/")) {
        return preview_route::file(app, rest, request.headers()).await;
    }
    if let Some(response) =
        comparison_routes::route(app, &path, request.uri(), request.headers()).await
    {
        return response;
    }
    let document = path.strip_prefix(&generated(""));
    let delivery = app.publications.delivery(document);
    let snapshot = &delivery.snapshot;
    if let Some(status) = shell(&path, snapshot) {
        return response::bytes(status, "text/html; charset=utf-8", snapshot.stub.clone());
    }
    if let Some(file) = snapshot.files.get(&path) {
        let body = file.body(snapshot.index.revision);
        return delivery.gzip.response(&path, request.headers(), body).await;
    }
    if let Some(file) = snapshot.assets.get(&path) {
        if response::is_json(&file.content_type) {
            let body = JsonBody::Whole(file.bytes.clone());
            return delivery.gzip.response(&path, request.headers(), body).await;
        }
        return response::bytes(StatusCode::OK, &file.content_type, file.bytes.clone());
    }
    if let Some(route) = document {
        return generated_routes::route(app, snapshot, route, request.headers()).await;
    }
    if let Some(path) = path.strip_prefix("static/") {
        return match app
            .work
            .authored(snapshot.documents.clone(), path.into())
            .await
        {
            Ok(Some(file)) => asset_response::deliver(file, request.headers()).await,
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
    response::missing()
}

fn shell(path: &str, snapshot: &Snapshot) -> Option<StatusCode> {
    if path.is_empty() || path == "index.html" || path == "404.html" {
        return Some(StatusCode::OK);
    }
    if path == "view/" {
        return Some(StatusCode::NOT_FOUND);
    }
    let path = path.strip_prefix("view/")?;
    let path = path
        .strip_suffix("/index.html")
        .or_else(|| path.strip_suffix('/'))
        .unwrap_or(path);
    is_entry_path(path).then(|| {
        if snapshot.entries.contains(path)
            || snapshot
                .index
                .removed_entries
                .iter()
                .any(|removed| match &removed.entry {
                    mokly_model::public_records::CatalogueRecord::Screen(entry) => {
                        entry.entry.path == path
                    }
                    mokly_model::public_records::CatalogueRecord::Component(entry) => {
                        entry.entry.path == path
                    }
                    mokly_model::public_records::CatalogueRecord::Page(entry) => {
                        entry.entry.path == path
                    }
                    mokly_model::public_records::CatalogueRecord::Document(entry) => {
                        entry.entry.path == path
                    }
                    mokly_model::public_records::CatalogueRecord::UseCase(entry) => {
                        entry.entry.path == path
                    }
                })
        {
            StatusCode::OK
        } else {
            StatusCode::NOT_FOUND
        }
    })
}
