//! Single-flight fills, fallback streaming and authorization ordering.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use bytes::Bytes;
use futures_util::future::join_all;
use futures_util::stream;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::{FileStore, FileStoreMock};
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use mkc_publications::access::CatalogueAccessMock;
use mkc_publications::error::Error as PublicationError;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::cache::{BlobCache, CacheFill, LruBlobCache};
use crate::catalogue::{Catalogue, FileBody, PublishedCatalogue, Served};
use crate::error::Error;
use crate::test_support::{ID, body, catalogue, locations, read_body, request};

fn key(bytes: &[u8]) -> BlobKey {
    BlobKey {
        hash: BlobHash::digest(bytes),
        incarnation: Uuid::from_u128(9),
    }
}

async fn bytes(stream: BlobStream) -> Vec<u8> {
    read_body(stream.into_body()).await.unwrap()
}

fn fill(cache: &LruBlobCache, key: BlobKey, bytes: &[u8]) {
    let CacheFill::Reserved(reservation) = cache.begin_fill(&key, bytes.len() as u64).unwrap()
    else {
        panic!("expected cache reservation")
    };
    reservation.complete(Bytes::copy_from_slice(bytes)).unwrap();
}

fn delivery_service() -> PublishedCatalogue {
    PublishedCatalogue {
        access: Arc::new(Unimock::new(())),
        transactions: Arc::new(Unimock::new(())),
        files: Arc::new(Unimock::new(())),
        cache: None,
        locations: locations(),
    }
}

fn storage(value: &'static [u8]) -> Arc<dyn FileStore> {
    Arc::new(Unimock::new(
        FileStoreMock::open
            .each_call(matching!(_, None))
            .answers_arc(Arc::new(move |_, key, _| {
                Ok(Some(BlobStream::full(
                    key,
                    value.len() as u64,
                    body(value.to_vec()),
                )?))
            })),
    ))
}

#[tokio::test]
async fn a_cached_full_object_serves_later_ranges_without_storage() {
    let value = b"static/screen.html";
    let mut service = delivery_service();
    service.files = storage(value);
    let cache = Arc::new(LruBlobCache::new(1024).unwrap());
    service.cache = Some(cache);
    assert_eq!(
        bytes(
            service
                .open_body(&key(value), value.len() as u64, None)
                .await
                .unwrap()
        )
        .await,
        value
    );

    let range = ByteRange::new(2, 6, value.len() as u64).unwrap();
    assert_eq!(
        bytes(
            service
                .open_body(&key(value), value.len() as u64, Some(range))
                .await
                .unwrap()
        )
        .await,
        &value[2..=6]
    );
}

#[tokio::test]
async fn ranged_cache_misses_never_populate_from_partial_bytes() {
    let value = b"static/screen.html";
    let range = ByteRange::new(2, 6, value.len() as u64).unwrap();
    let mut service = delivery_service();
    let cache = Arc::new(LruBlobCache::new(1024).unwrap());
    service.cache = Some(cache.clone());
    service.files = Arc::new(Unimock::new(
        FileStoreMock::open
            .next_call(matching!(_, Some(_)))
            .answers_arc(Arc::new(move |_, _, selected| {
                assert_eq!(selected, Some(range));
                Ok(Some(BlobStream::ranged(
                    value.len() as u64,
                    range,
                    body(value[2..=6].to_vec()),
                )?))
            })),
    ));

    let stream = service
        .open_body(&key(value), value.len() as u64, Some(range))
        .await
        .unwrap();
    assert_eq!(bytes(stream).await, &value[2..=6]);
    assert!(cache.get(&key(value)).unwrap().is_none());
}

#[tokio::test]
async fn concurrent_misses_open_storage_once_and_share_verified_bytes() {
    let value = Bytes::from_static(b"index.html");
    let opens = Arc::new(AtomicUsize::new(0));
    let mut service = delivery_service();
    let cache = Arc::new(LruBlobCache::new(1024).unwrap());
    service.cache = Some(cache.clone());
    service.files = Arc::new(Unimock::new(
        FileStoreMock::open
            .each_call(matching!(_, None))
            .answers_arc({
                let opens = opens.clone();
                let value = value.clone();
                Arc::new(move |_, key, _| {
                    opens.fetch_add(1, Ordering::SeqCst);
                    let value = value.clone();
                    let delayed = stream::once(async move {
                        tokio::time::sleep(Duration::from_millis(20)).await;
                        Ok(value)
                    });
                    Ok(Some(BlobStream::full(key, 10, Box::pin(delayed))?))
                })
            }),
    ));
    let service = Arc::new(service);

    let requests = (0..16).map(|_| {
        let service = service.clone();
        async move {
            let stream = service.open_body(&key(b"index.html"), 10, None).await?;
            Ok::<_, Error>(bytes(stream).await)
        }
    });
    for result in join_all(requests).await {
        assert_eq!(result.unwrap(), b"index.html");
    }
    assert_eq!(opens.load(Ordering::SeqCst), 1);
    assert!(cache.peak_accounted_bytes() <= 1024);
}

#[tokio::test]
async fn refused_reservations_stream_without_cache_buffering() {
    let value = b"index.html";
    let mut service = delivery_service();
    service.files = storage(value);
    let cache = Arc::new(LruBlobCache::new(4).unwrap());
    service.cache = Some(cache.clone());
    let stream = service
        .open_body(&key(value), value.len() as u64, None)
        .await
        .unwrap();
    assert_eq!(bytes(stream).await, value);
    assert_eq!(cache.accounted_bytes(), 0);
}

#[tokio::test]
async fn failed_fill_is_not_cached_and_a_waiter_streams_recovery() {
    let opens = Arc::new(AtomicUsize::new(0));
    let mut service = delivery_service();
    let cache = Arc::new(LruBlobCache::new(1024).unwrap());
    service.cache = Some(cache.clone());
    service.files = Arc::new(Unimock::new(
        FileStoreMock::open
            .each_call(matching!(_, None))
            .answers_arc({
                let opens = opens.clone();
                Arc::new(move |_, key, _| {
                    let call = opens.fetch_add(1, Ordering::SeqCst);
                    let actual = if call == 0 {
                        Bytes::from_static(b"bad-bytes!")
                    } else {
                        Bytes::from_static(b"index.html")
                    };
                    let delayed = stream::once(async move {
                        tokio::time::sleep(Duration::from_millis(20)).await;
                        Ok(actual)
                    });
                    Ok(Some(BlobStream::full(key, 10, Box::pin(delayed))?))
                })
            }),
    ));
    let service = Arc::new(service);
    let object_key = key(b"index.html");
    let first = service.open_body(&object_key, 10, None);
    let second = service.open_body(&object_key, 10, None);
    let (first, second) = tokio::join!(first, second);
    assert!(first.is_err());
    assert_eq!(bytes(second.unwrap()).await, b"index.html");
    assert_eq!(opens.load(Ordering::SeqCst), 2);
    assert!(cache.get(&key(b"index.html")).unwrap().is_none());
}

#[tokio::test]
async fn populated_cache_never_bypasses_private_authorization() {
    let value = b"index.html";
    let mut service = catalogue(true, true);
    let cache = Arc::new(LruBlobCache::new(1024).unwrap());
    fill(&cache, key(value), value);
    service.cache = Some(cache);
    let Served::File {
        body: Some(FileBody::Storage(body_request)),
        ..
    } = service.serve(request("/"), &mut false).unwrap()
    else {
        panic!("expected authorized file")
    };
    assert_eq!(
        bytes(service.open(body_request).await.unwrap()).await,
        value
    );
    service.access = Arc::new(Unimock::new(
        CatalogueAccessMock::authorize
            .next_call(matching!(&ID, _, _))
            .returns(Err(PublicationError::Unauthorized)),
    ));

    assert!(matches!(
        service.serve(request("/"), &mut false),
        Err(Error::Unauthorized)
    ));
}

#[test]
fn head_and_not_modified_responses_never_consult_cache_bytes() {
    let mut service = catalogue(false, true);
    service.cache = Some(Arc::new(Unimock::new(())));
    let mut input = request("/");
    input.head = true;
    assert!(matches!(
        service.serve(input, &mut false).unwrap(),
        Served::File { body: None, .. }
    ));

    let mut service = catalogue(false, true);
    service.cache = Some(Arc::new(Unimock::new(())));
    let mut input = request("/");
    input.if_none_match = Some(format!("W/\"{}\"", BlobHash::digest(b"index.html")));
    assert!(matches!(
        service.serve(input, &mut false).unwrap(),
        Served::File {
            status: 304,
            body: None,
            ..
        }
    ));
}
