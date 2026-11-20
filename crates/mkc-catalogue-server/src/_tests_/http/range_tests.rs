//! HTTP range framing and request-header forwarding.

use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{FileBody, FileFraming, ServeMock, Served};
use crate::test_support::{ID, body, locations};

use super::router;

#[tokio::test]
async fn partial_response_has_exact_range_headers_and_is_never_coded() {
    let range = ByteRange::new(2, 6, 10).unwrap();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, request, _| {
            assert_eq!(request.range.as_deref(), Some("bytes=2-6"));
            assert!(!request.if_range);
            Ok(Served::File {
                status: 206,
                body: Some(FileBody::Ready(
                    BlobStream::ranged(10, range, body(b"23456".to_vec())).unwrap(),
                )),
                framing: FileFraming::Partial(range),
                content_type: "application/json".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
            })
        },
    )));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/data.json")
                .header("Host", locations().authority(ID))
                .header("Range", "bytes=2-6")
                .header("Accept-Encoding", "gzip, br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(response.headers()["content-range"], "bytes 2-6/10");
    assert_eq!(response.headers()["content-length"], "5");
    assert_eq!(response.headers()["accept-ranges"], "bytes");
    assert!(!response.headers().contains_key("content-encoding"));
    assert_eq!(to_bytes(response.into_body(), 16).await.unwrap(), "23456");
}

#[tokio::test]
async fn unsatisfied_response_has_total_length_without_a_fallback_body() {
    let catalogue = Unimock::new(
        ServeMock
            .next_call(matching!(_, _))
            .answers(&|_, request, _| {
                assert_eq!(request.range.as_deref(), Some("bytes=99-"));
                Ok(Served::File {
                    status: 416,
                    body: None,
                    framing: FileFraming::Unsatisfiable(10),
                    content_type: "text/plain".into(),
                    cache: "no-store",
                    etag: "W/\"hash\"".into(),
                })
            }),
    );
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/file.txt")
                .header("Host", locations().authority(ID))
                .header("Range", "bytes=99-")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
    assert_eq!(response.headers()["content-range"], "bytes */10");
    assert_eq!(response.headers()["accept-ranges"], "bytes");
    assert_eq!(response.headers()["content-length"], "0");
    assert!(to_bytes(response.into_body(), 16).await.unwrap().is_empty());
}

#[tokio::test]
async fn head_range_is_forwarded_without_a_body() {
    let range = ByteRange::new(4, 9, 10).unwrap();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, request, _| {
            assert!(request.head);
            assert!(!request.if_range);
            assert_eq!(request.range.as_deref(), Some("bytes=4-"));
            Ok(Served::File {
                status: 206,
                body: None,
                framing: FileFraming::Partial(range),
                content_type: "text/plain".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
            })
        },
    )));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/file.txt")
                .header("Host", locations().authority(ID))
                .header("Range", "bytes=4-")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(response.headers()["content-range"], "bytes 4-9/10");
    assert_eq!(response.headers()["content-length"], "6");
    assert!(to_bytes(response.into_body(), 16).await.unwrap().is_empty());
}

#[tokio::test]
async fn if_range_presence_is_forwarded_to_the_full_response_selection() {
    let catalogue = Unimock::new(
        ServeMock
            .next_call(matching!(_, _))
            .answers(&|_, request, _| {
                assert!(request.if_range);
                assert_eq!(request.range.as_deref(), Some("bytes=4-"));
                Ok(Served::File {
                    status: 200,
                    body: None,
                    framing: FileFraming::Full(10),
                    content_type: "text/plain".into(),
                    cache: "no-cache",
                    etag: "W/\"hash\"".into(),
                })
            }),
    );
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/file.txt")
                .header("Host", locations().authority(ID))
                .header("Range", "bytes=4-")
                .header("If-Range", "\"strong\"")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-length"], "10");
    assert!(!response.headers().contains_key("content-range"));
    assert!(to_bytes(response.into_body(), 16).await.unwrap().is_empty());
}
