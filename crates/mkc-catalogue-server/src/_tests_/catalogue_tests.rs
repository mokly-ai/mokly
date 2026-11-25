//! Every published export delivery route class resolves through its file index.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_file_store_interface::stream::BlobStream;
use mkc_publications::access::CatalogueAccessMock;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{Catalogue, FileBody, FileFraming, PublishedCatalogue, Served};
use crate::test_support::{ID, body, catalogue, locations, publication, read_body, request};

async fn bytes(catalogue: &dyn Catalogue, body: Option<FileBody>) -> Vec<u8> {
    let stream = match body.unwrap() {
        FileBody::Storage(request) => catalogue.open(request).await.unwrap(),
        FileBody::Ready(stream) => stream,
    };
    read_body(stream.into_body()).await.unwrap()
}

#[tokio::test]
async fn exact_files_and_directory_indexes_preserve_bytes_extensions_and_mime() {
    for (path, expected, mime) in [
        ("/", "index.html", "text/html; charset=utf-8"),
        ("/index.html", "index.html", "text/html; charset=utf-8"),
        ("/view/a.html", "view/a.html", "text/html; charset=utf-8"),
        ("/view/legacy.htm", "view/legacy.htm", "text/html"),
        ("/id/a/", "id/a/index.html", "text/html; charset=utf-8"),
        (
            "/view/Product/Screen_1/",
            "view/Product/Screen_1/index.html",
            "text/html; charset=utf-8",
        ),
        (
            "/view/Product/Screen_1/index.html",
            "view/Product/Screen_1/index.html",
            "text/html; charset=utf-8",
        ),
        (
            "/static/mokly-generated/Product/Screen_1/index.desktop.html",
            "static/mokly-generated/Product/Screen_1/index.desktop.html",
            "text/html; charset=utf-8",
        ),
        (
            "/nested/path/",
            "nested/path/index.html",
            "text/html; charset=utf-8",
        ),
        (
            "/static/screen.html",
            "static/screen.html",
            "text/html; charset=utf-8",
        ),
        (
            "/static/app.js",
            "static/app.js",
            "text/javascript; charset=utf-8",
        ),
        ("/static/a.css", "static/a.css", "text/css; charset=utf-8"),
        ("/static/font.woff2", "static/font.woff2", "font/woff2"),
        (
            "/static/unknown",
            "static/unknown",
            "application/octet-stream",
        ),
        (
            "/mokly-viewer/catalogue.json",
            "mokly-viewer/catalogue.json",
            "application/json",
        ),
        (
            "/mokly-viewer/diffs/generations/abc/review.json",
            "mokly-viewer/diffs/generations/abc/review.json",
            "application/json",
        ),
        (
            "/mokly-viewer/diffs/generations/abc/snapshots/before/mokly-generated/Product/Screen_1/index.desktop.html",
            "mokly-viewer/diffs/generations/abc/snapshots/before/mokly-generated/Product/Screen_1/index.desktop.html",
            "text/html; charset=utf-8",
        ),
    ] {
        let mut input = request(path);
        input.query = Some("screen=x&view=changes".into());
        let catalogue = catalogue(false, false);
        let Served::File {
            status,
            body,
            content_type,
            cache,
            ..
        } = catalogue.serve(input, &mut false).unwrap()
        else {
            panic!("expected file")
        };
        assert_eq!(status, 200, "{path}");
        assert_eq!(bytes(&catalogue, body).await, expected.as_bytes());
        assert_eq!(content_type, mime);
        assert_eq!(
            cache,
            if path.contains("/diffs/") {
                "no-store"
            } else {
                "no-cache"
            }
        );
    }
}

#[tokio::test]
async fn slash_redirects_preserve_queries_and_unknown_routes_use_the_404_document() {
    for path in ["/id/a", "/nested/path", "/view/Product/Screen_1"] {
        let mut input = request(path);
        input.query = Some("screen=a%2Fb".into());
        let Served::Redirect { status, location } =
            catalogue(false, true).serve(input, &mut false).unwrap()
        else {
            panic!("expected redirect")
        };
        assert_eq!(status, 308);
        assert_eq!(location, format!("{path}/?screen=a%2Fb"));
    }
    for path in [
        "/missing",
        "/id/missing/",
        "/static/missing.js",
        "/view/a",
        "/mokly-upload.json",
        "/.mokly-export-artifact",
        "/_headers",
        "/_redirects",
        "/__blobs/invalid/index.html",
    ] {
        let catalogue = catalogue(false, false);
        let Served::File {
            status,
            body,
            cache,
            ..
        } = catalogue.serve(request(path), &mut false).unwrap()
        else {
            panic!("expected error document")
        };
        assert_eq!(status, 404, "{path}");
        assert_eq!(bytes(&catalogue, body).await, b"404.html");
        assert_eq!(cache, "no-store");
    }
}

#[test]
fn blob_routes_require_owned_path_and_hash_and_private_bytes_are_never_cached() {
    let hash = BlobHash::digest(b"index.html");
    for private in [false, true] {
        let Served::File { status, cache, .. } = catalogue(private, true)
            .serve(request(&format!("/__blobs/{hash}/index.html")), &mut false)
            .unwrap()
        else {
            panic!("expected file")
        };
        assert_eq!(status, 200);
        assert_eq!(
            cache,
            if private {
                "no-store"
            } else {
                "public, max-age=31536000, immutable"
            }
        );
    }
    let Served::File { status, .. } = catalogue(false, true)
        .serve(
            request(&format!("/__blobs/{hash}/static/app.js")),
            &mut false,
        )
        .unwrap()
    else {
        panic!("expected error document")
    };
    assert_eq!(status, 404);
}

#[test]
fn head_metadata_does_not_fetch_blob_bytes() {
    let mut input = request("/static/screen.html");
    input.head = true;
    let Served::File {
        status,
        body,
        framing,
        ..
    } = catalogue(true, true).serve(input, &mut false).unwrap()
    else {
        panic!("expected file")
    };
    assert_eq!(status, 200);
    assert!(body.is_none());
    assert_eq!(
        framing,
        FileFraming::Full("static/screen.html".len() as u64)
    );
}

#[tokio::test]
async fn provider_length_must_match_the_index_before_headers_are_served() {
    let mut catalogue = catalogue(false, true);
    catalogue.files = Arc::new(Unimock::new(
        FileStoreMock::open
            .next_call(matching!(_, None))
            .answers(&|_, key, _| Ok(Some(BlobStream::full(key, 1, body(b"x".to_vec()))?))),
    ));
    let Served::File {
        body: Some(FileBody::Storage(request)),
        ..
    } = catalogue.serve(request("/"), &mut false).unwrap()
    else {
        panic!("expected storage body")
    };
    assert!(catalogue.open(request).await.is_err());
}

#[test]
fn branch_hosts_redirect_to_canonical_publication_without_using_a_cookie() {
    let empty = Arc::new(Unimock::new(()));
    let catalogue = PublishedCatalogue {
        access: Arc::new(Unimock::new(
            CatalogueAccessMock::alias
                .next_call(matching!(_))
                .returns(Ok(publication())),
        )),
        transactions: empty.clone(),
        files: empty,
        cache: None,
        locations: locations(),
    };
    let mut input = request("/id/a/");
    input.host = format!("b-{}.br-main.preview.example.net", "a".repeat(40));
    input.query = Some("x=1".into());
    let Served::Redirect { status, location } = catalogue.serve(input, &mut false).unwrap() else {
        panic!("expected alias redirect")
    };
    assert_eq!(status, 307);
    assert_eq!(location, format!("{}/id/a/?x=1", locations().catalogue(ID)));
}
