//! Real path lookup through the HTTP adapter preserves redirect and HEAD metadata.

use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Method, Request, StatusCode};
use mkc_domain::client_origins::AdmittedOrigins;
use tower::ServiceExt;

use crate::http::CatalogueHandler;
use crate::router::{RouterBuilder, RouterFactory};
use crate::test_support::{ID, catalogue, locations};

#[tokio::test]
async fn obsolete_routes_return_the_indexed_fallback_with_head_parity() {
    for path in ["/__mokly", "/__Mokly/", "/%5F%5Fmokly/catalogue.json"] {
        let mut get_headers = None;
        for method in [Method::GET, Method::HEAD] {
            let router = RouterFactory {
                handler: Arc::new(CatalogueHandler {
                    catalogue: Arc::new(catalogue(false, method == Method::HEAD)),
                    origins: AdmittedOrigins::new(locations().app_origin.clone(), false),
                }),
                origins: AdmittedOrigins::new(locations().app_origin, false),
            }
            .build()
            .unwrap();
            let response = router
                .oneshot(
                    Request::builder()
                        .method(method.clone())
                        .uri(path)
                        .header("Host", locations().authority(ID))
                        .header("X-Request-ID", "catalogue-head-parity")
                        .header("Origin", locations().app_origin)
                        .header("Accept-Encoding", "br")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
            assert_eq!(response.headers()["cache-control"], "no-store");
            assert_eq!(response.headers()["content-length"], "8");
            assert_eq!(response.headers()["x-content-type-options"], "nosniff");
            assert!(response.headers().get("location").is_none());
            assert!(response.headers().get("content-encoding").is_none());
            if method == Method::GET {
                get_headers = Some(response.headers().clone());
            } else {
                assert_eq!(Some(response.headers()), get_headers.as_ref());
            }
            let bytes = to_bytes(response.into_body(), 100).await.unwrap();
            assert_eq!(
                bytes.as_ref(),
                if method == Method::GET {
                    b"404.html".as_slice()
                } else {
                    b""
                }
            );
        }
    }
}
