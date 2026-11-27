//! HTTP framing, access exchange, isolation headers and streaming policy.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{Request, header, request::Builder};
use axum::response::Response;
use mkc_domain::client_origins::AdmittedOrigins;
use tower::ServiceExt;

use crate::catalogue::Catalogue;
use crate::http::CatalogueHandler;
use crate::router::{RouterBuilder, RouterFactory};
use crate::test_support::{ID, locations};

mod access_file_tests;
mod access_tests;
mod bearer_tests;
#[cfg(feature = "compression-benchmark")]
mod compression_benchmark_tests;
mod compression_support;
mod compression_tests;
mod desktop_origin_tests;
mod embedded_access_support;
mod frame_access_tests;
mod headers_tests;
mod namespace_delivery_tests;
mod range_tests;
mod refused_identity_tests;
mod stream_tests;

fn router(catalogue: impl Catalogue + 'static) -> Router {
    RouterFactory {
        handler: Arc::new(CatalogueHandler {
            catalogue: Arc::new(catalogue),
            origins: AdmittedOrigins::new(locations().app_origin.clone(), false),
        }),
        origins: AdmittedOrigins::new(locations().app_origin, false),
    }
    .build()
    .unwrap()
}

fn file_request(path: &str) -> Builder {
    Request::builder()
        .uri(path)
        .header(header::HOST, locations().authority(ID))
}

async fn send(router: &Router, request: Builder) -> Response {
    router
        .clone()
        .oneshot(request.body(Body::empty()).unwrap())
        .await
        .unwrap()
}
