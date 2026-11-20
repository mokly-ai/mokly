//! In-process HTTP response capture for endpoint unit tests.

#![allow(clippy::unwrap_used)]

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::Request;
use axum::response::Response;
use tower::ServiceExt;

use super::response_validation::validate;

pub(crate) async fn checked(router: Router, request: Request<Body>) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let response = router.oneshot(request).await.unwrap();
    let (parts, body) = response.into_parts();
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    validate(method.as_str(), &path, parts.status.as_u16(), &bytes);
    Response::from_parts(parts, Body::from(bytes))
}
