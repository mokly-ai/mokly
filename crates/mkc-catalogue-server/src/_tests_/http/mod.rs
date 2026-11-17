//! HTTP framing, access exchange, isolation headers and streaming policy.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use axum::Router;
use mkc_domain::client_origins::AdmittedOrigins;
use unimock::Unimock;

use crate::http::CatalogueHandler;
use crate::router::{RouterBuilder, RouterFactory};
use crate::test_support::locations;

mod access_tests;
mod compression_benchmark_tests;
mod compression_support;
mod compression_tests;
mod desktop_origin_tests;
mod headers_tests;
mod namespace_delivery_tests;
mod range_tests;
mod refused_identity_tests;
mod stream_tests;

fn router(catalogue: Unimock) -> Router {
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
