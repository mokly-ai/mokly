//! In-process HTTP requests with injected services and no socket or clock.

use std::sync::Arc;

use axum::Router;
use axum::body::{Body, Bytes, to_bytes};
use axum::http::{Method, Request};
use axum::response::Response;
use tokio::sync::watch;
use tower::ServiceExt;
use unimock::Unimock;

use crate::application::{Application, HttpApplication};
use crate::publication::Publications;

pub(crate) fn application(publications: Arc<dyn Publications>) -> Application {
    Application::new(
        publications,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    )
}

pub(crate) fn router(app: Application) -> Router {
    Arc::new(app).router(watch::channel(false).1)
}

pub(crate) async fn request(
    router: &Router,
    method: Method,
    path: &str,
    headers: &[(&str, &str)],
) -> Response {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("host", "127.0.0.1:4173");
    for &(name, value) in headers {
        builder = builder.header(name, value);
    }
    router
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap()
}

pub(crate) async fn body(response: Response) -> Bytes {
    to_bytes(response.into_body(), usize::MAX).await.unwrap()
}
