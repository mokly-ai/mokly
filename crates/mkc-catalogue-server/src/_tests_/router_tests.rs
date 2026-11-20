//! Reserved health routing never reaches publication storage or authorization.

#![allow(clippy::unwrap_used)]

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mkc_domain::client_origins::AdmittedOrigins;
use tower::ServiceExt;
use unimock::Unimock;

use crate::http::CatalogueHandler;
use crate::router::{RouterBuilder, RouterFactory};
use crate::test_support::locations;

#[tokio::test]
async fn health_requires_no_host_cookie_or_catalogue_lookup() {
    let response = RouterFactory {
        handler: Arc::new(CatalogueHandler {
            catalogue: Arc::new(Unimock::new(())),
            origins: AdmittedOrigins::new(locations().app_origin, false),
        }),
        origins: AdmittedOrigins::new(locations().app_origin, false),
    }
    .build()
    .unwrap()
    .oneshot(
        Request::builder()
            .uri("/_health")
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    assert!(!response.headers().contains_key("set-cookie"));
}
