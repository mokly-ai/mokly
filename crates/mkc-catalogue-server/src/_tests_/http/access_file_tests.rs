//! The exact public Mokly files use ordinary indexed delivery and worker scope.

use std::sync::Arc;

use axum::body::to_bytes;
use axum::http::{Method, StatusCode, header};
use mkc_domain::blob::BlobHash;
use mkc_domain::values::Visibility;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use mkc_publications::access::CatalogueAccessMock;
use unimock::{MockFn, Unimock, matching};

use crate::test_support::{ID, authorized, body, file_index, mocked_catalogue};

use super::embedded_access_support::{
    START_BYTES, START_PATH, WORKER_BYTES, WORKER_PATH, anonymous_private, blob_url,
    embedded_catalogue, embedded_files,
};
use super::{file_request, router, send};

#[tokio::test]
async fn exact_mokly_files_allow_anonymous_private_get_and_head() {
    let router = router(embedded_catalogue(anonymous_private()));
    for (path, mime, bytes, scope) in [
        (START_PATH, "text/html", START_BYTES, None),
        (WORKER_PATH, "text/javascript", WORKER_BYTES, Some("/")),
    ] {
        for method in [Method::GET, Method::HEAD] {
            let head = method == Method::HEAD;
            let response = send(
                &router,
                file_request(&format!("/{path}"))
                    .method(method)
                    .header(header::IF_NONE_MATCH, "*"),
            )
            .await;
            let headers = response.headers();
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            assert_eq!(headers[header::CONTENT_TYPE], mime);
            assert_eq!(headers[header::CACHE_CONTROL], "no-store");
            assert_eq!(headers[header::ACCEPT_RANGES], "bytes");
            assert_eq!(headers[header::CONTENT_LENGTH], bytes.len().to_string());
            assert_eq!(
                headers
                    .get("service-worker-allowed")
                    .map(|value| value.to_str().unwrap()),
                scope
            );
            assert_eq!(
                to_bytes(response.into_body(), 1024).await.unwrap(),
                if head { b"" } else { bytes },
                "{path}"
            );
        }
    }
}

#[tokio::test]
async fn anonymous_mokly_files_use_the_normal_range_selection() {
    for (path, bytes, scope) in [
        (START_PATH, START_BYTES, None),
        (WORKER_PATH, WORKER_BYTES, Some("/")),
    ] {
        let range = ByteRange::new(0, 1, bytes.len() as u64).unwrap();
        let storage = Unimock::new(
            FileStoreMock::open
                .next_call(matching!(_, Some(_)))
                .answers_arc(Arc::new(move |_, key, selected| {
                    assert_eq!(key.hash, BlobHash::digest(bytes));
                    assert_eq!(selected, Some(range));
                    Ok(Some(BlobStream::ranged(
                        bytes.len() as u64,
                        range,
                        body(&bytes[..2]),
                    )?))
                })),
        );
        let router = router(mocked_catalogue(
            anonymous_private(),
            file_index(embedded_files()),
            storage,
        ));
        for method in [Method::GET, Method::HEAD] {
            let head = method == Method::HEAD;
            let response = send(
                &router,
                file_request(&format!("/{path}"))
                    .method(method)
                    .header(header::RANGE, "bytes=0-1"),
            )
            .await;
            let headers = response.headers();
            assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT, "{path}");
            assert_eq!(headers[header::CACHE_CONTROL], "no-store");
            assert_eq!(headers[header::CONTENT_LENGTH], "2");
            assert_eq!(
                headers[header::CONTENT_RANGE],
                format!("bytes 0-1/{}", bytes.len())
            );
            assert_eq!(
                headers
                    .get("service-worker-allowed")
                    .map(|value| value.to_str().unwrap()),
                scope
            );
            assert_eq!(
                to_bytes(response.into_body(), 1024).await.unwrap(),
                if head { b"" } else { &bytes[..2] },
                "{path}"
            );
        }
    }
}

#[tokio::test]
async fn worker_scope_follows_the_indexed_worker_on_public_and_authorized_routes() {
    for (visibility, cookie) in [
        (Visibility::Private, Some("signed")),
        (Visibility::Public, None),
    ] {
        let access = Unimock::new(
            CatalogueAccessMock::authorize
                .each_call(matching!(&ID, None, _, _))
                .answers_arc(Arc::new(move |_, _, _, actual, _| {
                    assert_eq!(actual(), cookie);
                    authorized(visibility)
                })),
        );
        let router = router(embedded_catalogue(access));
        for (path, scope) in [
            (format!("/{WORKER_PATH}"), Some("/")),
            (blob_url(WORKER_PATH, WORKER_BYTES), Some("/")),
            ("/mokly-viewer/client/Access-Worker.js".into(), None),
            ("/index.html".into(), None),
        ] {
            let mut request = file_request(&path);
            if let Some(cookie) = cookie {
                request = request.header(header::COOKIE, format!("__Host-mkc_catalogue={cookie}"));
            }
            let response = send(&router, request).await;
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            assert_eq!(
                response
                    .headers()
                    .get("service-worker-allowed")
                    .map(|value| value.to_str().unwrap()),
                scope,
                "{path}"
            );
        }
    }
}
