//! Range validation and final-byte integrity behavior.

#![allow(clippy::unwrap_used)]

use std::io;

use bytes::Bytes;
use futures_util::{StreamExt, future, stream};
use mkc_domain::blob::{BlobHash, BlobKey};

use super::{BlobBody, BlobStream, ByteRange};

fn key(bytes: &[u8]) -> BlobKey {
    BlobKey::from_object_name(&format!(
        "sha256/{}/00000000-0000-7000-8000-000000000001",
        BlobHash::digest(bytes)
    ))
    .unwrap()
}

fn body(bytes: impl Into<Bytes>) -> BlobBody {
    Box::pin(stream::once(future::ready(Ok(bytes.into()))))
}

async fn read(mut body: BlobBody) -> (Vec<u8>, Option<io::Error>) {
    let mut output = Vec::new();
    while let Some(item) = body.next().await {
        match item {
            Ok(bytes) => output.extend_from_slice(&bytes),
            Err(error) => return (output, Some(error)),
        }
    }
    (output, None)
}

#[test]
fn byte_ranges_are_inclusive_and_tied_to_the_validated_length() {
    let range = ByteRange::new(2, 4, 8).unwrap();
    assert_eq!(range.start(), 2);
    assert_eq!(range.end(), 4);
    assert_eq!(range.length(), 3);
    assert_eq!(range.total_length(), 8);
    assert!(ByteRange::new(4, 3, 8).is_none());
    assert!(ByteRange::new(8, 8, 8).is_none());
    assert!(ByteRange::new(0, 0, 0).is_none());
}

#[tokio::test]
async fn full_stream_releases_its_final_byte_only_after_verification() {
    let expected = b"body";
    let stream = BlobStream::full(
        &key(expected),
        expected.len() as u64,
        body(expected.to_vec()),
    )
    .unwrap();
    let mut body = stream.into_body();
    assert_eq!(body.next().await.unwrap().unwrap(), b"bod".as_slice());
    assert_eq!(body.next().await.unwrap().unwrap(), b"y".as_slice());
    assert!(body.next().await.is_none());
}

#[tokio::test]
async fn empty_full_streams_verify_at_eof() {
    let stream = BlobStream::full(&key(b""), 0, body(Vec::new())).unwrap();
    let (bytes, error) = read(stream.into_body()).await;
    assert!(bytes.is_empty());
    assert!(error.is_none());

    let stream = BlobStream::full(&key(b"not empty"), 0, body(Vec::new())).unwrap();
    assert!(read(stream.into_body()).await.1.is_some());
}

#[tokio::test]
async fn corrupt_or_short_full_streams_never_release_the_final_byte() {
    for (expected, actual, length) in [
        (b"good".as_slice(), b"evil".as_slice(), 4),
        (b"body".as_slice(), b"body".as_slice(), 5),
    ] {
        let stream = BlobStream::full(&key(expected), length, body(actual.to_vec())).unwrap();
        let (bytes, error) = read(stream.into_body()).await;
        assert!(error.is_some());
        assert_eq!(bytes, &actual[..actual.len() - 1]);
    }
}

#[tokio::test]
async fn ranged_streams_enforce_the_selected_length() {
    let range = ByteRange::new(2, 4, 8).unwrap();
    let stream = BlobStream::ranged(8, range, body(b"cde".to_vec())).unwrap();
    let (bytes, error) = read(stream.into_body()).await;
    assert_eq!(bytes, b"cde");
    assert!(error.is_none());

    let stream = BlobStream::ranged(8, range, body(b"cd".to_vec())).unwrap();
    assert!(read(stream.into_body()).await.1.is_some());
    assert!(BlobStream::ranged(7, range, body(Vec::new())).is_err());
}
