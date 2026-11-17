//! GET, HEAD, error, CORS and catalogue-isolation response metadata.

use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::stream::BlobStream;
use mkc_mokly_contract::index::INDEX_PATH;
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{FileBody, FileFraming, ServeMock, Served};
use crate::error::Error;
use crate::test_support::{ID, body, locations};

use super::router;

fn stream(bytes: &[u8]) -> BlobStream {
    let hash = BlobHash::digest(bytes);
    let key = BlobKey::from_object_name(&format!(
        "sha256/{hash}/00000000-0000-7000-8000-000000000001"
    ))
    .unwrap();
    BlobStream::full(&key, bytes.len() as u64, body(bytes.to_vec())).unwrap()
}

async fn assert_json_content_type(path: &str) {
    let catalogue = Unimock::new(ServeMock.some_call(matching!(_, _)).answers(&|_, _, _| {
        Ok(Served::File {
            status: 200,
            body: Some(FileBody::Ready(stream(b"{}"))),
            framing: FileFraming::Full(2),
            content_type: "application/json".into(),
            cache: "no-cache",
            etag: "W/\"hash\"".into(),
        })
    }));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri(format!("/{path}"))
                .header("Host", locations().authority(ID))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "application/json; charset=utf-8"
    );
}

#[tokio::test]
async fn catalogue_index_response_has_utf8_json_content_type() {
    assert_json_content_type(INDEX_PATH).await;
}

#[tokio::test]
async fn entry_detail_response_has_utf8_json_content_type() {
    assert_json_content_type("mokly-viewer/entries/Product/Screen_1.json").await;
}

#[tokio::test]
async fn all_response_classes_have_csp_nosniff_and_exact_cors() {
    for status in [200, 307, 308, 401, 403, 404, 500] {
        let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
            move |_, request, _| {
                assert_eq!(request.host, locations().authority(ID));
                assert_eq!(request.path, "/index.html");
                assert_eq!(request.cookie.as_deref(), Some("cookie"));
                if status == 500 {
                    Err(Error::internal(Error::NotFound))
                } else if matches!(status, 307 | 308) {
                    Ok(Served::Redirect {
                        status,
                        location: "/directory/".into(),
                    })
                } else {
                    Ok(Served::File {
                        status,
                        body: Some(FileBody::Ready(stream(b"body"))),
                        framing: FileFraming::Full(4),
                        content_type: "text/html".into(),
                        cache: "no-store",
                        etag: "W/\"hash\"".into(),
                    })
                }
            },
        )));
        let response = router(catalogue)
            .oneshot(
                Request::builder()
                    .uri("/index.html")
                    .header("Host", locations().authority(ID))
                    .header("Origin", "https://app.example.com")
                    .header("Cookie", "irrelevant=x; __Host-mkc_catalogue=cookie")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), status);
        let headers = response.headers();
        assert_eq!(headers["vary"], "Origin, Cookie, Accept-Encoding");
        assert_eq!(headers["x-content-type-options"], "nosniff");
        assert_eq!(headers["referrer-policy"], "no-referrer");
        assert_eq!(headers["cache-control"], "no-store");
        assert_eq!(
            headers["access-control-allow-origin"],
            "https://app.example.com"
        );
        assert_eq!(headers["access-control-allow-credentials"], "true");
        let csp = headers["content-security-policy"].to_str().unwrap();
        assert!(csp.ends_with("frame-ancestors 'self' https://app.example.com"));
        assert_eq!(csp.matches("frame-ancestors").count(), 1);
        assert!(!csp.contains('*'));
        assert!(!csp.contains("evil.example"));
        assert!(csp.contains("object-src 'none'; base-uri 'none'; form-action 'none'"));
        assert!(headers.contains_key("x-request-id"));
    }
}

#[tokio::test]
async fn get_and_head_keep_identical_file_headers() {
    for method in ["GET", "HEAD"] {
        let head = method == "HEAD";
        let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
            move |_, request, _| {
                assert_eq!(request.head, head);
                Ok(Served::File {
                    status: 200,
                    body: (!head).then(|| FileBody::Ready(stream(b"body"))),
                    framing: FileFraming::Full(4),
                    content_type: "text/html".into(),
                    cache: "no-cache",
                    etag: "W/\"hash\"".into(),
                })
            },
        )));
        let response = router(catalogue)
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri("/index.html")
                    .header("Host", locations().authority(ID))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["content-type"], "text/html");
        assert_eq!(response.headers()["content-length"], "4");
        assert_eq!(response.headers()["cache-control"], "no-cache");
        assert_eq!(response.headers()["etag"], "W/\"hash\"");
        assert_eq!(response.headers()["accept-ranges"], "bytes");
        let body = to_bytes(response.into_body(), 16).await.unwrap();
        let expected: &[u8] = if head { b"" } else { b"body" };
        assert_eq!(body.as_ref(), expected);
    }
}

#[tokio::test]
async fn preflight_is_exact_origin_and_head_errors_have_no_body() {
    let response = router(Unimock::new(()))
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/_access")
                .header("Host", locations().authority(ID))
                .header("Origin", "https://app.example.com")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        response.headers()["vary"],
        "Origin, Cookie, Accept-Encoding"
    );
    assert!(response.status().is_success());
    assert_eq!(
        response.headers()["access-control-allow-origin"],
        "https://app.example.com"
    );
    let catalogue = Unimock::new(
        ServeMock
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Err(Error::NotFound)),
    );
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri("/")
                .header("Host", locations().authority(ID))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        response.headers()["vary"],
        "Origin, Cookie, Accept-Encoding"
    );
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(
        to_bytes(response.into_body(), 1024)
            .await
            .unwrap()
            .is_empty()
    );
}
