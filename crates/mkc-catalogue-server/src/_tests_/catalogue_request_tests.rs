//! Range and conditional selection after authorization and exact path lookup.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{Catalogue, FileBody, FileFraming, Served};
use crate::test_support::{body, catalogue, catalogue_with_clear_cookie, read_body, request};

async fn body_bytes(catalogue: &dyn Catalogue, body: Option<FileBody>) -> Vec<u8> {
    let stream = match body.unwrap() {
        FileBody::Storage(request) => catalogue.open(request).await.unwrap(),
        FileBody::Ready(stream) => stream,
    };
    read_body(stream.into_body()).await.unwrap()
}

#[tokio::test]
async fn satisfiable_range_opens_only_the_selected_storage_bytes() {
    let bytes = b"static/screen.html";
    let selected = ByteRange::new(2, 6, bytes.len() as u64).unwrap();
    let selected_bytes = bytes[2..=6].to_vec();
    let mut service = catalogue(false, true);
    service.files = Arc::new(Unimock::new(
        FileStoreMock::open
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, range| {
                assert_eq!(range, Some(selected));
                Ok(Some(BlobStream::ranged(
                    bytes.len() as u64,
                    selected,
                    body(selected_bytes.clone()),
                )?))
            })),
    ));
    let mut input = request("/static/screen.html");
    input.range = Some("bytes=2-6".into());

    let Served::File {
        status,
        body,
        framing,
        cache,
        etag,
        ..
    } = service.serve(input, &mut false).unwrap()
    else {
        panic!("expected ranged file")
    };
    assert_eq!(status, 206);
    assert_eq!(framing, FileFraming::Partial(selected));
    assert_eq!(cache, "no-cache");
    assert_eq!(etag, format!("W/\"{}\"", BlobHash::digest(bytes)));
    assert_eq!(body_bytes(&service, body).await, bytes[2..=6]);
}

#[test]
fn unsatisfiable_and_head_ranges_never_open_storage() {
    let mut unsatisfiable = request("/static/screen.html");
    unsatisfiable.range = Some("bytes=999-".into());
    let Served::File {
        status,
        body,
        framing,
        cache,
        ..
    } = catalogue(false, true)
        .serve(unsatisfiable, &mut false)
        .unwrap()
    else {
        panic!("expected unsatisfied range")
    };
    assert_eq!(status, 416);
    assert!(body.is_none());
    assert_eq!(framing, FileFraming::Unsatisfiable(18));
    assert_eq!(cache, "no-store");

    let mut head = request("/static/screen.html");
    head.range = Some("bytes=-5".into());
    head.head = true;
    let Served::File {
        status,
        body,
        framing,
        ..
    } = catalogue(false, true).serve(head, &mut false).unwrap()
    else {
        panic!("expected HEAD range")
    };
    assert_eq!(status, 206);
    assert!(body.is_none());
    assert_eq!(
        framing,
        FileFraming::Partial(ByteRange::new(13, 17, 18).unwrap())
    );
}

#[tokio::test]
async fn invalid_multiple_if_range_and_404_requests_use_the_full_representation() {
    for (value, if_range) in [
        ("bytes=0-1,4-5", false),
        ("items=0-1", false),
        ("bytes=0-1", true),
    ] {
        let mut input = request("/static/screen.html");
        input.range = Some(value.into());
        input.if_range = if_range;
        let catalogue = catalogue(false, false);
        let Served::File {
            status,
            body,
            framing,
            ..
        } = catalogue.serve(input, &mut false).unwrap()
        else {
            panic!("expected full file")
        };
        assert_eq!(status, 200);
        assert_eq!(framing, FileFraming::Full(18));
        assert_eq!(body_bytes(&catalogue, body).await, b"static/screen.html");
    }

    let mut missing = request("/missing");
    missing.range = Some("bytes=0-1".into());
    let catalogue = catalogue(false, false);
    let Served::File {
        status,
        body,
        framing,
        ..
    } = catalogue.serve(missing, &mut false).unwrap()
    else {
        panic!("expected 404 fallback")
    };
    assert_eq!(status, 404);
    assert_eq!(framing, FileFraming::Full(8));
    assert_eq!(body_bytes(&catalogue, body).await, b"404.html");
}

#[test]
fn public_weak_strong_list_and_wildcard_validators_return_304_before_ranges() {
    let hash = BlobHash::digest(b"index.html");
    for (path, value) in [
        ("/", format!("W/\"{hash}\"")),
        ("/", format!("\"other\", \"{hash}\"")),
        ("/", "*".into()),
        (
            &format!("/__blobs/{hash}/index.html"),
            format!("W/\"{hash}\""),
        ),
    ] {
        let mut input = request(path);
        input.if_none_match = Some(value);
        input.range = Some("bytes=0-0".into());
        let Served::File {
            status,
            body,
            framing,
            cache,
            etag,
            ..
        } = catalogue(false, true).serve(input, &mut false).unwrap()
        else {
            panic!("expected conditional file")
        };
        assert_eq!(status, 304);
        assert!(body.is_none());
        assert_eq!(framing, FileFraming::NotModified(10));
        assert_eq!(etag, format!("W/\"{hash}\""));
        assert_eq!(
            cache,
            if path.starts_with("/__blobs/") {
                "public, max-age=31536000, immutable"
            } else {
                "no-cache"
            }
        );
    }
}

#[tokio::test]
async fn malformed_and_nonmatching_validators_send_the_full_public_file() {
    let hash = BlobHash::digest(b"index.html");
    for value in ["\"different\"".into(), format!("W/\"{hash}\", invalid")] {
        let mut input = request("/");
        input.if_none_match = Some(value);
        let catalogue = catalogue(false, false);
        let Served::File {
            status,
            body,
            framing,
            ..
        } = catalogue.serve(input, &mut false).unwrap()
        else {
            panic!("expected public file")
        };
        assert_eq!(status, 200);
        assert_eq!(framing, FileFraming::Full(10));
        assert_eq!(body_bytes(&catalogue, body).await, b"index.html");
    }
}

#[tokio::test]
async fn every_no_store_file_class_ignores_matching_conditionals() {
    let cases = [
        (true, false, "/", b"index.html".as_slice()),
        (
            false,
            false,
            "/mokly-viewer/diffs/generations/abc/review.json",
            b"mokly-viewer/diffs/generations/abc/review.json".as_slice(),
        ),
        (false, false, "/missing", b"404.html".as_slice()),
        (false, true, "/", b"index.html".as_slice()),
    ];
    for (private, clear_cookie, path, bytes) in cases {
        let mut input = request(path);
        input.if_none_match = Some(format!("W/\"{}\"", BlobHash::digest(bytes)));
        let mut should_clear = false;
        let catalogue = catalogue_with_clear_cookie(private, false, clear_cookie);
        let Served::File {
            status,
            body,
            cache,
            ..
        } = catalogue.serve(input, &mut should_clear).unwrap()
        else {
            panic!("expected no-store file")
        };
        assert_ne!(status, 304, "{path}");
        assert_eq!(body_bytes(&catalogue, body).await, bytes, "{path}");
        assert_eq!(cache, "no-store", "{path}");
        assert_eq!(should_clear, clear_cookie);
    }
}
