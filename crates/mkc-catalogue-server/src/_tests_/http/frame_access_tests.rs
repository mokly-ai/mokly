//! Private frame navigation and the exact unauthenticated file allow list.

use axum::body::to_bytes;
use axum::http::{Method, StatusCode, header};
use mkc_domain::values::Visibility;
use mkc_publications::access::CatalogueAccessMock;
use mkc_publications::error::Error;
use mkc_store_interface::blob::BlobsMock;
use unimock::{MockFn, Unimock, matching};

use crate::test_support::{
    ID, authorized, full_storage, indexed_file, mocked_catalogue, transactions,
};

use super::embedded_access_support::{
    PRIVATE_FILES, START_BYTES, START_PATH, WORKER_BYTES, WORKER_PATH, anonymous_private, blob_url,
    embedded_catalogue, embedded_files, iframe,
};
use super::{file_request, router, send};

#[tokio::test]
async fn private_iframe_navigation_streams_the_start_page_without_looking_up_the_requested_path() {
    let access = Unimock::new(
        CatalogueAccessMock::authorize
            .each_call(matching!(&ID, None, _, _))
            .answers(&|_, _, _, cookie, clear_cookie| {
                assert_eq!(cookie(), Some("stale"));
                *clear_cookie = true;
                Err(Error::Unauthorized)
            }),
    );
    let index = transactions(Unimock::new(
        BlobsMock::publication_file
            .each_call(matching!(&ID, &START_PATH))
            .answers(&|_, _, path| Ok(Some(indexed_file(path, START_BYTES))))
            .n_times(3),
    ));
    let router = router(mocked_catalogue(
        access,
        index,
        full_storage(&embedded_files()),
    ));
    for path in [
        "/static/screen.html",
        "/missing",
        "/mokly-viewer/client/access-worker.js",
    ] {
        let response = send(
            &router,
            iframe(file_request(path))
                .header(header::RANGE, "bytes=0-1")
                .header(header::IF_NONE_MATCH, "*")
                .header(header::ACCEPT_ENCODING, "br")
                .header(header::COOKIE, "__Host-mkc_catalogue=stale"),
        )
        .await;
        let headers = response.headers();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(headers[header::CONTENT_TYPE], "text/html; charset=utf-8");
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
        assert_eq!(
            headers[header::CONTENT_LENGTH],
            START_BYTES.len().to_string()
        );
        assert_eq!(headers.get(header::CONTENT_RANGE), None);
        assert_eq!(headers.get(header::CONTENT_ENCODING), None);
        assert_eq!(headers.get("service-worker-allowed"), None);
        assert_eq!(
            headers[header::SET_COOKIE],
            "__Host-mkc_catalogue=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0; Partitioned"
        );
        assert_eq!(
            to_bytes(response.into_body(), 1024).await.unwrap(),
            START_BYTES,
            "{path}"
        );
    }
}

#[tokio::test]
async fn other_request_modes_and_methods_keep_the_ordinary_private_denial() {
    let router = router(mocked_catalogue(
        anonymous_private(),
        Unimock::new(()),
        Unimock::new(()),
    ));
    for (method, mode, dest) in [
        (Method::GET, "navigate", Some("document")),
        (Method::GET, "navigate", None),
        (Method::GET, "cors", Some("iframe")),
        (Method::HEAD, "navigate", Some("iframe")),
    ] {
        let head = method == Method::HEAD;
        let mut request = file_request("/static/screen.html")
            .method(method)
            .header("Sec-Fetch-Mode", mode);
        if let Some(dest) = dest {
            request = request.header("Sec-Fetch-Dest", dest);
        }
        let response = send(&router, request).await;
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "{mode} {dest:?}"
        );
        assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
        let body = to_bytes(response.into_body(), 1024).await.unwrap();
        assert_eq!(body.is_empty(), head);
    }
}

#[tokio::test]
async fn private_iframe_navigation_without_an_indexed_start_page_keeps_the_ordinary_denial() {
    let index = transactions(Unimock::new(
        BlobsMock::publication_file
            .next_call(matching!(&ID, &START_PATH))
            .returns(Ok(None)),
    ));
    let router = router(mocked_catalogue(
        anonymous_private(),
        index,
        Unimock::new(()),
    ));
    let response = send(&router, iframe(file_request("/static/screen.html"))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
}

#[tokio::test]
async fn direct_reads_of_missing_public_access_files_keep_the_ordinary_denial() {
    for path in [START_PATH, WORKER_PATH] {
        let index = transactions(Unimock::new(
            BlobsMock::publication_file
                .next_call(matching!(&ID, path))
                .returns(Ok(None)),
        ));
        let router = router(mocked_catalogue(
            anonymous_private(),
            index,
            Unimock::new(()),
        ));
        let response = send(&router, file_request(&format!("/{path}"))).await;
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(
            response.headers()[header::CONTENT_TYPE],
            "application/json",
            "{path}"
        );
        assert_eq!(
            response.headers()[header::CACHE_CONTROL],
            "no-store",
            "{path}"
        );
        assert_eq!(
            response.headers().get("service-worker-allowed"),
            None,
            "{path}"
        );
    }
}

#[tokio::test]
async fn public_iframe_navigation_still_serves_the_requested_file() {
    let access = Unimock::new(
        CatalogueAccessMock::authorize
            .next_call(matching!(&ID, None, _, _))
            .answers(&|_, _, _, cookie, _| {
                assert_eq!(cookie(), None);
                authorized(Visibility::Public)
            }),
    );
    let router = router(embedded_catalogue(access));
    let response = send(&router, iframe(file_request("/static/screen.html"))).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-cache");
    assert_eq!(
        to_bytes(response.into_body(), 1024).await.unwrap(),
        b"<p>Private screen</p>".as_slice()
    );
}

#[tokio::test]
async fn every_other_private_file_and_each_bootstrap_alias_still_requires_a_credential() {
    let router = router(embedded_catalogue(anonymous_private()));
    let paths = PRIVATE_FILES
        .iter()
        .map(|(path, _)| format!("/{path}"))
        .chain([
            "/".into(),
            format!("/{START_PATH}/"),
            format!("/{WORKER_PATH}/"),
            "/mokly-viewer/client/%61ccess-start.html".into(),
            blob_url(START_PATH, START_BYTES),
            blob_url(WORKER_PATH, WORKER_BYTES),
        ]);
    for path in paths {
        let direct = send(&router, file_request(&path)).await;
        assert_eq!(direct.status(), StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(
            direct.headers()[header::CONTENT_TYPE],
            "application/json",
            "{path}"
        );
        assert_eq!(
            direct.headers().get("service-worker-allowed"),
            None,
            "{path}"
        );

        let navigation = send(&router, iframe(file_request(&path))).await;
        assert_eq!(navigation.status(), StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(
            navigation.headers()[header::CONTENT_TYPE],
            "text/html; charset=utf-8",
            "{path}"
        );
        assert_eq!(
            to_bytes(navigation.into_body(), 1024).await.unwrap(),
            START_BYTES,
            "{path}"
        );
    }
}
