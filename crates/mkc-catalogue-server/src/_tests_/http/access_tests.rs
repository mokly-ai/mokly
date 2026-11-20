//! Grant exchange deadlines, cookie handling and request rejection.

use std::io;
use std::sync::Arc;
use std::time::Duration;

use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::stream::BlobStream;
use tokio_stream::wrappers::ReceiverStream;
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{
    BodyRequest, ExchangeMock, FileBody, FileFraming, OpenMock, ServeMock, Served,
};
use crate::error::Error;
use crate::test_support::{ID, body, locations};

use super::router;

fn key(bytes: &[u8]) -> BlobKey {
    let hash = BlobHash::digest(bytes);
    BlobKey::from_object_name(&format!(
        "sha256/{hash}/00000000-0000-7000-8000-000000000001"
    ))
    .unwrap()
}

fn empty_stream() -> BlobStream {
    BlobStream::full(&key(b""), 0, body(Vec::new())).unwrap()
}

#[tokio::test]
async fn grant_exchange_sets_only_a_short_lived_host_cookie() {
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
                .body(Body::from(r#"{"grant":"grant"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        response.headers()["vary"],
        "Origin, Cookie, Accept-Encoding"
    );
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        response.headers()["set-cookie"],
        "__Host-mkc_catalogue=signed; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300"
    );
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(
        to_bytes(response.into_body(), 1024)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn grant_exchange_rejects_foreign_origins_queries_extra_fields_and_oversize_bodies() {
    for (origin, path, body, expected) in [
        (
            "https://evil.example",
            "/_access",
            r#"{"grant":"g"}"#.to_owned(),
            403,
        ),
        (
            "https://app.example.com",
            "/_access?grant=x",
            "{}".to_owned(),
            400,
        ),
        (
            "https://app.example.com",
            "/_access",
            r#"{"grant":"g","extra":1}"#.to_owned(),
            400,
        ),
        ("https://app.example.com", "/_access", "x".repeat(1025), 400),
    ] {
        let response = router(Unimock::new(()))
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .header("Host", locations().authority(ID))
                    .header("Origin", origin)
                    .header("Content-Type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.headers()["vary"],
            "Origin, Cookie, Accept-Encoding"
        );
        assert_eq!(response.status().as_u16(), expected);
        assert!(!response.headers().contains_key("set-cookie"));
    }
}

#[tokio::test(start_paused = true)]
async fn grant_body_reception_has_a_finite_deadline() {
    let (_sender, receiver) = tokio::sync::mpsc::channel::<io::Result<String>>(1);
    let request = Request::builder()
        .method("POST")
        .uri("/_access")
        .header("Host", locations().authority(ID))
        .header("Origin", "https://app.example.com")
        .header("Content-Type", "application/json")
        .body(Body::from_stream(ReceiverStream::new(receiver)))
        .unwrap();
    let result = tokio::time::timeout(
        Duration::from_secs(11),
        router(Unimock::new(())).oneshot(request),
    )
    .await;
    assert!(
        result.is_ok(),
        "grant body reception must stop before eleven seconds"
    );
    assert_eq!(result.unwrap().unwrap().status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn invalid_cookies_are_expired_on_success_redirects_and_denials() {
    for status in [200, 308, 401] {
        let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
            move |_, _, clear| {
                *clear = true;
                if status == 401 {
                    Err(Error::Unauthorized)
                } else if status == 308 {
                    Ok(Served::Redirect {
                        status,
                        location: "/directory/".into(),
                    })
                } else {
                    Ok(Served::File {
                        status,
                        body: Some(FileBody::Ready(empty_stream())),
                        framing: FileFraming::Full(0),
                        content_type: "text/html".into(),
                        cache: "public, max-age=31536000, immutable",
                        etag: "hash".into(),
                    })
                }
            },
        )));
        let response = router(catalogue)
            .oneshot(
                Request::builder()
                    .uri("/")
                    .header("Host", locations().authority(ID))
                    .header("Cookie", "__Host-mkc_catalogue=stale")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), status);
        assert_eq!(
            response.headers()["set-cookie"],
            "__Host-mkc_catalogue=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0"
        );
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(
            response.headers()["vary"],
            "Origin, Cookie, Accept-Encoding"
        );
    }
}

#[tokio::test]
async fn invalid_cookie_is_expired_when_async_storage_open_fails() {
    let object_key = key(b"body");
    let catalogue = Unimock::new((
        ServeMock
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, clear| {
                *clear = true;
                Ok(Served::File {
                    status: 200,
                    body: Some(FileBody::Storage(BodyRequest {
                        key: object_key.clone(),
                        length: 4,
                        range: None,
                    })),
                    framing: FileFraming::Full(4),
                    content_type: "text/plain".into(),
                    cache: "no-store",
                    etag: "W/\"hash\"".into(),
                })
            })),
        OpenMock
            .next_call(matching!(_))
            .answers(&|_, _| Err(Error::internal(Error::NotFound))),
    ));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/")
                .header("Host", locations().authority(ID))
                .header("Cookie", "__Host-mkc_catalogue=invalid")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert!(
        response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert_eq!(response.headers()["cache-control"], "no-store");
}
