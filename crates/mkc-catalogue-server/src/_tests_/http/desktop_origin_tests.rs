//! The grant check, CORS and framing use one origin set in both flag states.

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, header};
use mkc_domain::client_origins::{AdmittedOrigins, DESKTOP_ORIGIN};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::ExchangeMock;
use crate::http::CatalogueHandler;
use crate::router::{RouterBuilder, RouterFactory};
use crate::test_support::{ID, locations};

#[tokio::test]
async fn catalogue_grants_and_headers_share_the_exact_admitted_origins() {
    let app = locations().app_origin;
    for desktop in [false, true] {
        for origin in [
            app.as_str(),
            DESKTOP_ORIGIN,
            "https://third.example.com",
            "null",
        ] {
            let admitted = origin == app || desktop && origin == DESKTOP_ORIGIN;
            for (method, path) in [
                ("POST", "/_access"),
                ("GET", "/_health"),
                ("HEAD", "/_health"),
                ("OPTIONS", "/_access"),
            ] {
                let catalogue = if method == "POST" && admitted {
                    Unimock::new(
                        ExchangeMock
                            .next_call(matching!(_, "grant"))
                            .returns(Ok("signed".into())),
                    )
                } else {
                    Unimock::new(())
                };
                let origins = AdmittedOrigins::new(app.clone(), desktop);
                let router = RouterFactory {
                    handler: Arc::new(CatalogueHandler {
                        catalogue: Arc::new(catalogue),
                        origins: origins.clone(),
                    }),
                    origins,
                }
                .build()
                .unwrap();
                let response = router
                    .oneshot(
                        Request::builder()
                            .method(method)
                            .uri(path)
                            .header(header::HOST, locations().authority(ID))
                            .header(header::ORIGIN, origin)
                            .header(header::CONTENT_TYPE, "application/json")
                            .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                            .body(Body::from(r#"{"grant":"grant"}"#))
                            .unwrap(),
                    )
                    .await
                    .unwrap();
                if method == "POST" {
                    assert_eq!(response.status(), if admitted { 200 } else { 403 });
                    assert_eq!(
                        response.headers().contains_key(header::SET_COOKIE),
                        admitted
                    );
                }
                assert_eq!(
                    response
                        .headers()
                        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                        .map(|v| v.to_str().unwrap()),
                    admitted.then_some(origin)
                );
                let ancestors = if desktop {
                    format!("'self' {app} {DESKTOP_ORIGIN}")
                } else {
                    format!("'self' {app}")
                };
                assert!(
                    response.headers()[header::CONTENT_SECURITY_POLICY]
                        .to_str()
                        .unwrap()
                        .ends_with(&format!("frame-ancestors {ancestors}"))
                );
                assert_eq!(
                    response.headers()[header::VARY],
                    "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding"
                );
                if admitted {
                    assert_eq!(
                        response.headers()[header::ACCESS_CONTROL_ALLOW_CREDENTIALS],
                        "true"
                    );
                }
            }
        }
    }
}
