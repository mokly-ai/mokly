//! CORS echoes only an admitted origin on actual responses and preflights.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Method, Request, header};
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::{AdmittedOrigins, DESKTOP_ORIGIN};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::dispatch::DispatchMock;
use crate::payload::Reply;
use crate::router::{RouterBuilder, RouterFactory};

#[tokio::test]
async fn cors_admission_matches_the_flag_and_never_reflects_a_third_origin() {
    let app = "https://app.example.com";
    for desktop in [false, true] {
        for origin in [app, DESKTOP_ORIGIN, "https://third.example.com", "null"] {
            for method in [Method::GET, Method::OPTIONS] {
                let dispatcher = if method == Method::GET {
                    Unimock::new(
                        DispatchMock
                            .next_call(matching!(_))
                            .answers(&|_, _| Ok(Reply::empty())),
                    )
                } else {
                    Unimock::new(())
                };
                let router = RouterFactory {
                    trusted_proxies: TrustedProxies::default(),
                    dispatcher: Arc::new(dispatcher),
                    upload: Arc::new(Unimock::new(())),
                    live: Arc::new(Unimock::new(())),
                    origins: AdmittedOrigins::new(app.into(), desktop),
                    billing_configured: false,
                }
                .build()
                .unwrap();
                let mut request = Request::builder()
                    .method(method.clone())
                    .uri("/v1/session")
                    .header(header::ORIGIN, origin)
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .header(
                        header::ACCESS_CONTROL_REQUEST_HEADERS,
                        "content-type,x-csrf-token",
                    )
                    .body(Body::empty())
                    .unwrap();
                request
                    .extensions_mut()
                    .insert(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
                let response = router.oneshot(request).await.unwrap();
                let admitted = origin == app || desktop && origin == DESKTOP_ORIGIN;
                assert_eq!(
                    response
                        .headers()
                        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                        .map(|v| v.to_str().unwrap()),
                    admitted.then_some(origin)
                );
                if admitted {
                    assert_eq!(
                        response.headers()[header::ACCESS_CONTROL_ALLOW_CREDENTIALS],
                        "true"
                    );
                }
                assert!(
                    response
                        .headers()
                        .get_all(header::VARY)
                        .iter()
                        .any(|value| value
                            .to_str()
                            .unwrap()
                            .split(',')
                            .any(|part| part.trim().eq_ignore_ascii_case("origin")))
                );
            }
        }
    }
}
