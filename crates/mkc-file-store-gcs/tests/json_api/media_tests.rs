//! Streamed media reads: full and ranged bodies, statuses, headers and digests.

use std::io;

use futures_util::StreamExt;
use mkc_file_store_interface::stream::{BlobBody, ByteRange};

use crate::support::fixtures::{key, store};
use crate::support::server::{exchange, server};

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

#[tokio::test]
async fn streamed_media_opens_full_and_ranged_bodies_without_buffering() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let name = key.object_name().replace('/', "%2F");
    let target = format!("/storage/v1/b/catalogue-fixture/o/{name}?alt=media");
    let range = ByteRange::new(2, 8, bytes.len() as u64).unwrap();
    let ranged = exchange("GET", &target, 206, bytes[2..=8].to_vec())
        .expect_header("range", "bytes=2-8")
        .response_header("Content-Range", &format!("bytes 2-8/{}", bytes.len()));
    let (endpoint, handle) = server(vec![
        exchange("GET", &target, 200, bytes.to_vec()),
        ranged,
        exchange(
            "GET",
            &target,
            404,
            include_bytes!("../../fixtures/not-found.json").to_vec(),
        ),
    ]);
    let store = store(endpoint, None);

    let stream = store.open(&key, None).await.unwrap().unwrap();
    assert_eq!(stream.total_length(), bytes.len() as u64);
    assert_eq!(stream.served_range(), None);
    let (full, error) = read(stream.into_body()).await;
    assert!(error.is_none());
    assert_eq!(full, bytes);

    let stream = store.open(&key, Some(range)).await.unwrap().unwrap();
    assert_eq!(stream.total_length(), bytes.len() as u64);
    assert_eq!(stream.served_range(), Some(range));
    let (selected, error) = read(stream.into_body()).await;
    assert!(error.is_none());
    assert_eq!(selected, bytes[2..=8]);
    assert!(store.open(&key, None).await.unwrap().is_none());
    handle.join().unwrap();
}

#[tokio::test]
async fn streamed_media_rejects_status_header_and_digest_mismatches() {
    let expected = b"expected";
    let key = key(expected);
    let name = key.object_name().replace('/', "%2F");
    let target = format!("/storage/v1/b/catalogue-fixture/o/{name}?alt=media");
    let range = ByteRange::new(1, 3, expected.len() as u64).unwrap();

    let partial_full = exchange("GET", &target, 206, expected[1..=3].to_vec())
        .response_header("Content-Range", "bytes 1-3/8");
    let wrong_status =
        exchange("GET", &target, 200, expected[1..=3].to_vec()).expect_header("range", "bytes=1-3");
    let wrong_range = exchange("GET", &target, 206, expected[1..=3].to_vec())
        .expect_header("range", "bytes=1-3")
        .response_header("Content-Range", "bytes 1-3/99");
    let wrong_length = exchange("GET", &target, 206, expected[1..=3].to_vec())
        .expect_header("range", "bytes=1-3")
        .response_header("Content-Length", "2")
        .response_header("Content-Range", "bytes 1-3/8");
    let (endpoint, handle) = server(vec![
        partial_full,
        wrong_status,
        wrong_range,
        wrong_length,
        exchange("GET", &target, 200, b"corrupt!".to_vec()),
    ]);
    let store = store(endpoint, None);
    assert!(store.open(&key, None).await.is_err());
    assert!(store.open(&key, Some(range)).await.is_err());
    assert!(store.open(&key, Some(range)).await.is_err());
    assert!(store.open(&key, Some(range)).await.is_err());
    let stream = store.open(&key, None).await.unwrap().unwrap();
    let (prefix, error) = read(stream.into_body()).await;
    assert!(error.is_some());
    assert_eq!(prefix, b"corrupt");
    handle.join().unwrap();
}
