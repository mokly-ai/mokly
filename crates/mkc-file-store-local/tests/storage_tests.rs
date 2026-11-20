//! Real filesystem lifecycle, integrity, symlink and incarnation-fence tests.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fs;
use std::io;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::stream::BlobBody;
use mkc_file_store_interface::stream::ByteRange;
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use tempfile::TempDir;
use uuid::Uuid;

fn deadline() -> OperationDeadline {
    OperationDeadline::new(Duration::from_secs(60))
}

fn key(bytes: &[u8], incarnation: u128) -> BlobKey {
    BlobKey {
        hash: BlobHash::digest(bytes),
        incarnation: Uuid::from_u128(incarnation),
    }
}

async fn read(mut body: BlobBody) -> Result<Vec<u8>, io::Error> {
    let mut output = Vec::new();
    while let Some(bytes) = body.next().await {
        output.extend_from_slice(&bytes?);
    }
    Ok(output)
}

#[tokio::test]
async fn immutable_lifecycle_verifies_bytes_and_fences_old_deletion() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open(root.path()).unwrap();
    let old = key(b"catalogue", 1);
    let new = key(b"catalogue", 2);
    assert!(store.get(&old).unwrap().is_none());
    assert!(store.open(&old, None).await.unwrap().is_none());
    store
        .put(&old, Bytes::from_static(b"catalogue"), deadline())
        .unwrap();
    store
        .put(&old, Bytes::from_static(b"catalogue"), deadline())
        .unwrap();
    assert!(
        store
            .put(&old, Bytes::from_static(b"different"), deadline())
            .is_err()
    );
    assert_eq!(store.get(&old).unwrap().unwrap(), b"catalogue");
    let stream = store.open(&old, None).await.unwrap().unwrap();
    assert_eq!(stream.total_length(), 9);
    assert_eq!(stream.served_range(), None);
    let bytes = read(stream.into_body()).await.unwrap();
    assert_eq!(bytes, b"catalogue");

    let range = ByteRange::new(2, 5, 9).unwrap();
    let stream = store.open(&old, Some(range)).await.unwrap().unwrap();
    assert_eq!(stream.total_length(), 9);
    assert_eq!(stream.served_range(), Some(range));
    let bytes = read(stream.into_body()).await.unwrap();
    assert_eq!(bytes, b"talo");
    assert!(
        store
            .open(&old, Some(ByteRange::new(0, 1, 8).unwrap()))
            .await
            .is_err()
    );
    store
        .put(&new, Bytes::from_static(b"catalogue"), deadline())
        .unwrap();
    store.delete(&old).unwrap();
    assert!(store.get(&old).unwrap().is_none());
    store.delete(&old).unwrap();
    assert_eq!(store.get(&new).unwrap().unwrap(), b"catalogue");
    assert_eq!(store.list(None, 10).unwrap().items.len(), 1);
    fs::write(root.path().join(new.object_name()), b"tampered").unwrap();
    assert!(store.get(&new).is_err());
    let stream = store.open(&new, None).await.unwrap().unwrap();
    let mut body = stream.into_body();
    let mut bytes = Vec::new();
    let mut failed = false;
    while let Some(item) = body.next().await {
        match item {
            Ok(chunk) => bytes.extend_from_slice(&chunk),
            Err(_) => {
                failed = true;
                break;
            }
        }
    }
    assert!(failed);
    assert_eq!(bytes, b"tampere");
}

#[test]
fn listing_pages_without_repeating_or_skipping_objects() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open(root.path()).unwrap();
    for index in 1..=5 {
        store
            .put(
                &key(b"same bytes", index),
                Bytes::from_static(b"same bytes"),
                deadline(),
            )
            .unwrap();
    }
    let first = store.list(None, 2).unwrap();
    let second = store.list(first.next_cursor.as_deref(), 2).unwrap();
    let third = store.list(second.next_cursor.as_deref(), 2).unwrap();
    assert_eq!(
        (first.items.len(), second.items.len(), third.items.len()),
        (2, 2, 1)
    );
    assert!(third.next_cursor.is_none());
    let ids: Vec<_> = first
        .items
        .into_iter()
        .chain(second.items)
        .chain(third.items)
        .map(|object| object.key.incarnation.as_u128())
        .collect();
    assert_eq!(ids, [1, 2, 3, 4, 5]);
}

#[tokio::test]
async fn symlink_ancestors_and_files_are_never_followed() {
    let root = TempDir::new().unwrap();
    let elsewhere = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open(root.path()).unwrap();
    let value = key(b"data", 1);
    symlink(elsewhere.path(), root.path().join("sha256")).unwrap();
    assert!(
        store
            .put(&value, Bytes::from_static(b"data"), deadline())
            .is_err()
    );
    assert!(store.get(&value).is_err());
    assert!(store.open(&value, None).await.is_err());
    assert!(store.delete(&value).is_err());
    assert!(store.list(None, 10).is_err());
    assert_eq!(fs::read_dir(elsewhere.path()).unwrap().count(), 0);
    assert!(
        LocalFileStoreFactory
            .open(&root.path().join("sha256"))
            .is_err()
    );
}

#[test]
fn elapsed_operation_budget_fails_before_touching_the_filesystem() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open(root.path()).unwrap();
    let value = key(b"data", 1);
    let elapsed = OperationDeadline::new(Duration::ZERO);

    assert!(
        store
            .put(&value, Bytes::from_static(b"data"), elapsed)
            .is_err()
    );
    assert!(!root.path().join(value.object_name()).exists());
}

#[test]
fn newly_created_blob_root_is_private() {
    let parent = TempDir::new().unwrap();
    let root = parent.path().join("blobs");
    LocalFileStoreFactory.open(&root).unwrap();
    assert_eq!(
        fs::metadata(root).unwrap().permissions().mode() & 0o777,
        0o700
    );
}
