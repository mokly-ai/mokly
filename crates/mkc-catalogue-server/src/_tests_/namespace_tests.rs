//! Namespace refusal and immutable generation selection use decoded exact paths.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_publications::access::CatalogueAccessMock;
use mkc_publications::error::Error as PublicationError;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{Catalogue, FileBody, FileFraming, PublishedCatalogue, Served};
use crate::error::Error;
use crate::test_support::{catalogue, locations, read_body, request};

#[tokio::test]
async fn obsolete_namespace_is_a_no_store_indexed_404_on_get_and_head() {
    for path in [
        "/__mokly",
        "/__Mokly/",
        "/%5F%5Fmokly/catalogue.json",
        "/__mokly/catalogue.json",
        "/__mokly/diffs/__generations/abc/review.json",
    ] {
        for head in [false, true] {
            let service = catalogue(false, head);
            let mut input = request(path);
            input.head = head;
            input.if_none_match = Some("*".into());
            input.range = Some("bytes=0-1".into());
            let Served::File {
                status,
                body,
                framing,
                cache,
                etag,
                content_type,
                access_worker,
            } = service.serve(input, &mut false).unwrap()
            else {
                panic!("expected indexed 404");
            };
            assert_eq!(status, 404, "{path}");
            assert!(!access_worker);
            assert_eq!(cache, "no-store");
            assert_eq!(framing, FileFraming::Full(8));
            assert_eq!(content_type, "text/html");
            assert_eq!(etag, format!("W/\"{}\"", BlobHash::digest(b"404.html")));
            if head {
                assert!(body.is_none());
            } else {
                let Some(FileBody::Storage(body)) = body else {
                    panic!("expected stored fallback");
                };
                assert_eq!(
                    read_body(service.open(body).await.unwrap().into_body())
                        .await
                        .unwrap(),
                    b"404.html"
                );
            }
        }
    }
}

#[test]
fn obsolete_namespace_is_refused_through_owned_blob_paths() {
    for path in ["__mokly", "__Mokly/index.html", "__mokly/catalogue.json"] {
        let hash = BlobHash::digest(path.as_bytes());
        let mut input = request(&format!("/__blobs/{hash}/{path}"));
        input.head = true;
        let Served::File {
            status,
            body,
            cache,
            ..
        } = catalogue(false, true).serve(input, &mut false).unwrap()
        else {
            panic!("expected indexed 404");
        };
        assert_eq!(status, 404);
        assert_eq!(cache, "no-store");
        assert!(body.is_none());
    }
    let Served::Redirect { status, .. } = catalogue(false, true)
        .serve(request("/__mokly-allowed"), &mut false)
        .unwrap()
    else {
        panic!("ordinary authored paths stay available");
    };
    assert_eq!(status, 308);
}

#[test]
fn comparisons_are_no_store_on_blob_urls_and_generations_are_never_rewritten() {
    let path = "mokly-viewer/diffs/generations/abc/review.json";
    for route in [
        format!("/{path}"),
        format!("/__blobs/{}/{path}", BlobHash::digest(path.as_bytes())),
    ] {
        let mut input = request(&route);
        input.head = true;
        input.if_none_match = Some("*".into());
        let Served::File { status, cache, .. } =
            catalogue(false, true).serve(input, &mut false).unwrap()
        else {
            panic!("expected comparison");
        };
        assert_eq!(status, 200);
        assert_eq!(cache, "no-store");
    }
    for route in [
        "/mokly-viewer/diffs/generations/other/review.json",
        "/mokly-viewer/diffs/review.json",
    ] {
        let mut input = request(route);
        input.head = true;
        let Served::File { status, cache, .. } =
            catalogue(false, true).serve(input, &mut false).unwrap()
        else {
            panic!("expected exact miss");
        };
        assert_eq!(status, 404);
        assert_eq!(cache, "no-store");
    }
}

#[test]
fn obsolete_paths_keep_normal_private_access_checks() {
    let empty = Arc::new(Unimock::new(()));
    let service = PublishedCatalogue {
        access: Arc::new(Unimock::new(
            CatalogueAccessMock::authorize
                .next_call(matching!(_, _, _))
                .returns(Err(PublicationError::Unauthorized)),
        )),
        transactions: empty.clone(),
        files: empty,
        cache: None,
        locations: locations(),
    };
    assert!(matches!(
        service.serve(request("/__mokly"), &mut false),
        Err(Error::Unauthorized)
    ));
}
