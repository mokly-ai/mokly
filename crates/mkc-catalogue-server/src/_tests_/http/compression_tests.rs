//! Compression negotiation, exclusions, header survival and round trips.

use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{FileFraming, ServeMock, Served};
use crate::test_support::{ID, locations};

use super::compression_support::{decode, full_file, representative_catalogue_json};
use super::router;

async fn framed_response(
    method: &str,
    status: u16,
    bytes: Arc<[u8]>,
    accept_encoding: &str,
) -> axum::response::Response {
    let served = bytes.clone();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, request, _| {
            let mut response = full_file(served.clone(), "no-cache");
            let Served::File {
                status: response_status,
                body,
                framing,
                ..
            } = &mut response
            else {
                panic!("expected file response")
            };
            *response_status = status;
            if status == 304 {
                *framing = FileFraming::NotModified(served.len() as u64);
            }
            if request.head || status == 304 {
                *body = None;
            }
            Ok(response)
        },
    )));
    router(catalogue)
        .oneshot(
            Request::builder()
                .method(method)
                .uri("/mokly-viewer/index.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", accept_encoding)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

#[tokio::test]
async fn get_head_and_not_modified_share_each_representation_framing() {
    let bytes: Arc<[u8]> = vec![b'x'; 4096].into();
    for (accept_encoding, expected_encoding) in [
        ("identity", None),
        ("gzip", Some("gzip")),
        ("br", Some("br")),
    ] {
        let get = framed_response("GET", 200, bytes.clone(), accept_encoding).await;
        let head = framed_response("HEAD", 200, bytes.clone(), accept_encoding).await;
        let not_modified = framed_response("GET", 304, bytes.clone(), accept_encoding).await;
        for name in [
            "content-type",
            "content-encoding",
            "content-length",
            "cache-control",
            "etag",
            "accept-ranges",
            "vary",
            "content-security-policy",
            "x-content-type-options",
            "referrer-policy",
            "permissions-policy",
        ] {
            assert_eq!(head.headers().get(name), get.headers().get(name), "{name}");
        }
        assert_eq!(
            get.headers()
                .get("content-encoding")
                .and_then(|value| value.to_str().ok()),
            expected_encoding
        );
        assert_eq!(
            not_modified.headers().get("content-encoding"),
            get.headers().get("content-encoding")
        );
        assert!(!not_modified.headers().contains_key("content-length"));
        assert_eq!(not_modified.headers()["etag"], get.headers()["etag"]);
        assert_eq!(
            not_modified.headers()["cache-control"],
            get.headers()["cache-control"]
        );
        assert_eq!(not_modified.headers()["vary"], get.headers()["vary"]);
        let get_body = to_bytes(get.into_body(), bytes.len() * 2).await.unwrap();
        let decoded = expected_encoding
            .map_or_else(|| get_body.to_vec(), |encoding| decode(encoding, &get_body));
        assert_eq!(decoded, bytes.as_ref());
        assert!(to_bytes(head.into_body(), 16).await.unwrap().is_empty());
        assert!(
            to_bytes(not_modified.into_body(), 16)
                .await
                .unwrap()
                .is_empty()
        );
    }
}

#[tokio::test]
async fn compressed_response_preserves_security_cors_and_request_id_headers() {
    let bytes = format!(r#"{{"items":"{}"}}"#, "catalogue-entry,".repeat(1024)).into_bytes();
    let served = bytes.clone();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, _, _| Ok(full_file(served.clone().into(), "no-cache")),
    )));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Origin", "https://app.example.com")
                .header("Accept-Encoding", "gzip, br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let headers = response.headers();
    assert_eq!(headers["content-encoding"], "br");
    assert!(!headers.contains_key("content-length"));
    assert_eq!(headers["accept-ranges"], "bytes");
    assert_eq!(
        headers["vary"],
        "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding"
    );
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert_eq!(headers["referrer-policy"], "no-referrer");
    assert_eq!(
        headers["permissions-policy"],
        "camera=(), microphone=(), geolocation=(), payment=()"
    );
    assert_eq!(
        headers["access-control-allow-origin"],
        "https://app.example.com"
    );
    assert_eq!(headers["access-control-allow-credentials"], "true");
    assert!(headers.contains_key("x-request-id"));
    assert!(
        headers["content-security-policy"]
            .to_str()
            .unwrap()
            .contains("frame-ancestors 'self' https://app.example.com")
    );
    let compressed = to_bytes(response.into_body(), bytes.len() * 2)
        .await
        .unwrap();
    assert!(!compressed.is_empty());
    assert!(compressed.len() < bytes.len());
}

#[tokio::test]
async fn large_catalogue_json_round_trips_with_gzip_and_brotli() {
    let bytes = representative_catalogue_json();
    for encoding in ["gzip", "br"] {
        let served = bytes.clone();
        let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
            move |_, _, _| Ok(full_file(served.clone(), "no-cache")),
        )));
        let response = router(catalogue)
            .oneshot(
                Request::builder()
                    .uri("/catalogue.json")
                    .header("Host", locations().authority(ID))
                    .header("Accept-Encoding", encoding)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.headers()["content-encoding"], encoding);
        assert!(!response.headers().contains_key("content-length"));
        let compressed = to_bytes(response.into_body(), bytes.len() * 2)
            .await
            .unwrap();
        assert!(compressed.len() < bytes.len());
        assert_eq!(decode(encoding, &compressed), bytes.as_ref());
    }
}

#[tokio::test]
async fn head_and_not_modified_are_coded_while_no_store_stays_identity() {
    let bytes = format!(r#"{{"items":"{}"}}"#, "private,".repeat(512)).into_bytes();
    let length = bytes.len() as u64;
    let head = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, request, _| {
            assert!(request.head);
            Ok(Served::File {
                status: 200,
                body: None,
                framing: FileFraming::Full(length),
                content_type: "application/json".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
                access_worker: false,
            })
        },
    )));
    let response = router(head)
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["content-encoding"], "br");
    assert!(!response.headers().contains_key("content-length"));

    let not_modified = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, request, _| {
            assert_eq!(request.if_none_match.as_deref(), Some("W/\"hash\""));
            Ok(Served::File {
                status: 304,
                body: None,
                framing: FileFraming::NotModified(length),
                content_type: "application/json".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
                access_worker: false,
            })
        },
    )));
    let response = router(not_modified)
        .oneshot(
            Request::builder()
                .uri("/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("If-None-Match", "W/\"hash\"")
                .header("Accept-Encoding", "br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(response.headers()["content-encoding"], "br");
    assert!(!response.headers().contains_key("content-length"));
    assert_eq!(response.headers()["etag"], "W/\"hash\"");
    assert_eq!(response.headers()["cache-control"], "no-cache");
    assert_eq!(
        response.headers()["vary"],
        "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding"
    );
    assert_eq!(response.headers()["accept-ranges"], "bytes");
    assert!(to_bytes(response.into_body(), 16).await.unwrap().is_empty());

    let served = bytes.clone();
    let no_store = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, _, _| Ok(full_file(served.clone().into(), "no-store")),
    )));
    let response = router(no_store)
        .oneshot(
            Request::builder()
                .uri("/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert!(!response.headers().contains_key("content-encoding"));
    assert_eq!(response.headers()["content-length"], length.to_string());
    assert_eq!(
        to_bytes(response.into_body(), bytes.len() * 2)
            .await
            .unwrap(),
        bytes
    );
}
