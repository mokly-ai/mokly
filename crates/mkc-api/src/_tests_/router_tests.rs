//! Transport failures retain their correct source and HTTP classification.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::convert::Infallible;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::task::{Context, Poll};

use axum::body::{Body, Bytes, HttpBody, to_bytes};
use axum::extract::ConnectInfo;
use axum::http::Request;
use axum::response::Response;
use http_body::Frame;
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::AdmittedOrigins;

use crate::contract::response_capture::checked;
use crate::error::ApiError;
use crate::router::{RouterBuilder, RouterFactory, body_error};

#[tokio::test]
async fn only_body_length_failures_report_payload_too_large() {
    let oversized = to_bytes(Body::from("too long"), 1).await.unwrap_err();
    assert!(matches!(body_error(oversized), ApiError::PayloadTooLarge));
    let interrupted = axum::Error::new(io::Error::from(io::ErrorKind::UnexpectedEof));
    assert!(matches!(
        body_error(interrupted),
        ApiError::ValidationFailed
    ));
}

#[tokio::test]
async fn stripe_signature_must_be_present_exactly_once_before_body_read() {
    for repeated in [false, true] {
        let read = Arc::new(AtomicBool::new(false));
        let router = RouterFactory {
            trusted_proxies: TrustedProxies::default(),
            dispatcher: Arc::new(unimock::Unimock::new(())),
            upload: Arc::new(unimock::Unimock::new(())),
            origins: AdmittedOrigins::new("https://app.example.com".into(), false),
            billing_configured: true,
        }
        .build()
        .unwrap();
        let mut builder = Request::builder()
            .method("POST")
            .uri("/v1/billing/webhooks")
            .header("content-type", "application/json");
        if repeated {
            builder = builder
                .header("stripe-signature", "t=1,v1=00")
                .header("stripe-signature", "t=1,v1=11");
        }
        let mut request = builder
            .body(Body::new(ObservedBody { read: read.clone() }))
            .unwrap();
        request
            .extensions_mut()
            .insert(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
        let response: Response = checked(router, request).await;
        assert_eq!(response.status(), 400);
        assert!(!read.load(Ordering::SeqCst));
    }
}

struct ObservedBody {
    read: Arc<AtomicBool>,
}

impl HttpBody for ObservedBody {
    type Data = Bytes;
    type Error = Infallible;

    fn poll_frame(
        self: Pin<&mut Self>,
        _context: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        self.read.store(true, Ordering::SeqCst);
        Poll::Ready(None)
    }
}
