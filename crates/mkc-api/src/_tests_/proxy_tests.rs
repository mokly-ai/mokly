//! Router IP verification reaches authentication through the real dispatcher.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::Request;
use mkc_auth::error::Error;
use mkc_auth::service::AuthenticatorMock;
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::{AdmittedOrigins, ClientOrigin};
use unimock::{MockFn, Unimock, matching};

use crate::contract::response_capture::checked;
use crate::dispatch::ApiDispatcher;
use crate::router::{RouterBuilder, RouterFactory};

#[tokio::test]
async fn rate_limit_boundary_receives_only_the_verified_client() {
    for (hops, headers, expected) in [
        (0, vec!["192.0.2.5"], "10.0.0.1"),
        (2, vec!["203.0.113.9, 192.0.2.5, 10.0.0.2"], "192.0.2.5"),
        (2, vec!["192.0.2.5"], "10.0.0.1"),
        (1, vec!["192.0.2.5", "192.0.2.6"], "10.0.0.1"),
    ] {
        let auth = Unimock::new((
            AuthenticatorMock::origin
                .next_call(matching!(Some("https://app.example.com")))
                .returns(Ok(ClientOrigin::App)),
            AuthenticatorMock::issue
                .next_call(matching!("person@example.com", None, _, ClientOrigin::App))
                .answers_arc(Arc::new(move |_, _, _, peer, _| {
                    assert_eq!(peer, expected);
                    Err(Error::RateLimited(60))
                })),
        ));
        let router = RouterFactory {
            trusted_proxies: TrustedProxies {
                hops,
                networks: vec!["10.0.0.0/8".parse().unwrap()],
            },
            dispatcher: Arc::new(ApiDispatcher {
                builds: Arc::new(Unimock::new(())),
                auth: Arc::new(auth),
                platform: Arc::new(Unimock::new(())),
                health: Arc::new(Unimock::new(())),
                viewer: Arc::new(Unimock::new(())),
                access: Arc::new(Unimock::new(())),
                github: None,
                billing: None,
            }),
            upload: Arc::new(Unimock::new(())),
            origins: AdmittedOrigins::new("https://app.example.com".into(), false),
            billing_configured: false,
        }
        .build()
        .unwrap();
        let mut builder = Request::builder()
            .method("POST")
            .uri("/v1/auth/magic-links")
            .header("content-type", "application/json")
            .header("origin", "https://app.example.com");
        for value in headers {
            builder = builder.header("x-forwarded-for", value);
        }
        let mut request = builder
            .body(Body::from(r#"{"email":"person@example.com"}"#))
            .unwrap();
        request
            .extensions_mut()
            .insert(ConnectInfo("10.0.0.1:1234".parse::<SocketAddr>().unwrap()));
        assert_eq!(checked(router, request).await.status(), 429);
    }
}
