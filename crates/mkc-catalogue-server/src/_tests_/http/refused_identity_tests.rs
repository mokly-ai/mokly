//! Identity fallback when no requested content coding is acceptable.

use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{ExchangeMock, ServeMock, Served};
use crate::test_support::{ID, locations};

use super::compression_support::full_file;
use super::router;

#[tokio::test]
async fn public_file_falls_back_to_identity_when_identity_is_refused() {
    let bytes: Arc<[u8]> = Arc::from(b"public catalogue".as_slice());
    let served = bytes.clone();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, _, _| Ok(full_file(served.clone(), "no-cache")),
    )));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/mokly-viewer/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "identity;q=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!response.headers().contains_key("content-encoding"));
    assert_eq!(
        to_bytes(response.into_body(), bytes.len() * 2)
            .await
            .unwrap(),
        bytes.as_ref()
    );
}

#[tokio::test]
async fn private_file_keeps_no_store_when_every_representation_is_refused() {
    let bytes: Arc<[u8]> = Arc::from(b"private catalogue".as_slice());
    let served = bytes.clone();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, _, _| Ok(full_file(served.clone(), "no-store")),
    )));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/mokly-viewer/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "*;q=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(!response.headers().contains_key("content-encoding"));
    assert_eq!(
        to_bytes(response.into_body(), bytes.len() * 2)
            .await
            .unwrap(),
        bytes.as_ref()
    );
}

#[tokio::test]
async fn redirect_status_survives_refused_identity_preferences() {
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers(&|_, _, _| {
        Ok(Served::Redirect {
            status: 308,
            location: "/directory/".into(),
        })
    }));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/directory")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "gzip;q=0, br;q=0, identity;q=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PERMANENT_REDIRECT);
    assert_eq!(response.headers()["location"], "/directory/");
    assert_eq!(response.headers()["cache-control"], "no-store");
}

#[tokio::test]
async fn grant_exchange_status_survives_refused_identity_preferences() {
    let catalogue = Unimock::new(
        ExchangeMock
            .next_call(matching!(_, "grant"))
            .returns(Ok("signed".into())),
    );
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/_access")
                .header("Host", locations().authority(ID))
                .header("Origin", "https://app.example.com")
                .header("Content-Type", "application/json")
                .header("Accept-Encoding", "gzip;q=0, br;q=0, *;q=0")
                .body(Body::from(r#"{"grant":"grant"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(
        response.headers()["set-cookie"],
        "__Host-mkc_catalogue=signed; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300"
    );
}
