//! Byte reservations, eviction ordering and fill synchronization.

#![allow(clippy::unwrap_used, clippy::panic)]

use std::mem::size_of;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::Arc;

use bytes::Bytes;
use futures_util::future::join_all;
use mkc_domain::blob::{BlobHash, BlobKey};
use uuid::Uuid;

use crate::cache::{
    BlobCache, CacheFill, CacheKey, ENTRY_OVERHEAD_BYTES, Entry, LruBlobCache,
    MAX_CACHED_BLOB_BYTES,
};
use crate::error::Error;

const OVERHEAD: u64 = ENTRY_OVERHEAD_BYTES;

fn key(value: u128) -> BlobKey {
    BlobKey {
        hash: BlobHash::digest(&value.to_be_bytes()),
        incarnation: Uuid::from_u128(value),
    }
}

fn fill(cache: &LruBlobCache, key: BlobKey, length: usize) -> Option<Bytes> {
    match cache.begin_fill(&key, length as u64).unwrap() {
        CacheFill::Reserved(reservation) => Some(
            reservation
                .complete(Bytes::from(vec![0_u8; length]))
                .unwrap(),
        ),
        CacheFill::Bypass => None,
        CacheFill::Hit(_) | CacheFill::Wait(_) => panic!("unexpected existing fill"),
    }
}

#[test]
fn eviction_uses_total_bytes_instead_of_entry_count() {
    let capacity = 3 * OVERHEAD + 6;
    let cache = LruBlobCache::new(capacity).unwrap();
    assert!(fill(&cache, key(1), 4).is_some());
    assert!(fill(&cache, key(2), 1).is_some());
    assert!(fill(&cache, key(3), 2).is_some());

    assert!(cache.get(&key(1)).unwrap().is_none());
    assert!(cache.get(&key(2)).unwrap().is_some());
    assert!(cache.get(&key(3)).unwrap().is_some());
    assert!(cache.peak_accounted_bytes() <= capacity);
}

#[test]
fn admission_respects_object_ceiling_and_smaller_budget() {
    let cache = LruBlobCache::new(MAX_CACHED_BLOB_BYTES + 1).unwrap();
    assert!(matches!(
        cache
            .begin_fill(&key(1), MAX_CACHED_BLOB_BYTES + 1)
            .unwrap(),
        CacheFill::Bypass
    ));

    let smaller = LruBlobCache::new(OVERHEAD + 3).unwrap();
    assert!(fill(&smaller, key(3), 4).is_none());
    assert!(smaller.get(&key(3)).unwrap().is_none());
    assert!(fill(&smaller, key(4), 3).is_some());
    assert_eq!(smaller.accounted_bytes(), OVERHEAD + 3);

    let below_overhead = LruBlobCache::new(OVERHEAD - 1).unwrap();
    assert!(fill(&below_overhead, key(5), 0).is_none());
}

#[test]
fn zero_budget_allocates_no_cache_or_lock() {
    assert!(LruBlobCache::new(0).is_none());
}

#[test]
fn reads_promote_entries_before_lru_eviction() {
    let cache = LruBlobCache::new(2 * OVERHEAD + 6).unwrap();
    fill(&cache, key(1), 3).unwrap();
    fill(&cache, key(2), 3).unwrap();
    {
        let _response = cache.get(&key(1)).unwrap().unwrap();
    }
    fill(&cache, key(3), 3).unwrap();

    assert!(cache.get(&key(1)).unwrap().is_some());
    assert!(cache.get(&key(2)).unwrap().is_none());
    assert!(cache.get(&key(3)).unwrap().is_some());
}

#[test]
fn evicted_response_bytes_remain_inside_the_budget_until_released() {
    let capacity = OVERHEAD + 4;
    let cache = LruBlobCache::new(capacity).unwrap();
    fill(&cache, key(1), 4).unwrap();
    {
        let response_bytes = cache.get(&key(1)).unwrap().unwrap();
        assert!(fill(&cache, key(2), 4).is_none());
        assert_eq!(response_bytes.len(), 4);
        assert_eq!(cache.accounted_bytes(), capacity);
    }
    assert!(fill(&cache, key(2), 4).is_some());
    assert_eq!(cache.accounted_bytes(), capacity);
    assert!(cache.peak_accounted_bytes() <= capacity);
}

#[tokio::test]
async fn followers_receive_the_completed_single_fill() {
    let cache = LruBlobCache::new(OVERHEAD + 4).unwrap();
    let CacheFill::Reserved(reservation) = cache.begin_fill(&key(1), 4).unwrap() else {
        panic!("expected reservation")
    };
    let CacheFill::Wait(waiter) = cache.begin_fill(&key(1), 4).unwrap() else {
        panic!("expected waiter")
    };
    let leader = reservation.complete(Bytes::from_static(b"body")).unwrap();
    let follower = waiter.wait().await.unwrap().unwrap();
    assert_eq!(leader, follower);
    assert_eq!(cache.accounted_bytes(), OVERHEAD + 4);
}

#[tokio::test]
async fn concurrent_reservations_never_exceed_the_budget() {
    let capacity = 8 * (OVERHEAD + 8);
    let cache = Arc::new(LruBlobCache::new(capacity).unwrap());
    let barrier = Arc::new(tokio::sync::Barrier::new(33));
    let fills = (1..=32).map(|value| {
        let cache = cache.clone();
        let barrier = barrier.clone();
        async move {
            let fill = cache.begin_fill(&key(value), 8).unwrap();
            barrier.wait().await;
            if let CacheFill::Reserved(reservation) = fill {
                reservation
                    .complete(Bytes::from_static(b"12345678"))
                    .unwrap();
            }
        }
    });
    let all_fills = join_all(fills);
    let release = barrier.wait();
    tokio::join!(all_fills, release);

    assert!(cache.accounted_bytes() <= capacity);
    assert!(cache.peak_accounted_bytes() <= capacity);
}

#[test]
fn poisoned_lock_returns_a_typed_error() {
    let cache = LruBlobCache::new(1).unwrap();
    let result = catch_unwind(AssertUnwindSafe(|| {
        let _guard = cache.core.state.lock().unwrap();
        panic!("poison cache lock");
    }));
    assert!(result.is_err());
    assert!(matches!(cache.get(&key(1)), Err(Error::Internal(_))));
}

#[test]
fn zero_byte_and_tiny_entries_are_charged_their_overhead() {
    let capacity = 4 * OVERHEAD + 3;
    let cache = LruBlobCache::new(capacity).unwrap();
    for value in 0..1_000 {
        fill(&cache, key(value), (value % 2) as usize);
    }

    let retained: Vec<_> = (0..1_000)
        .filter(|value| cache.get(&key(*value)).unwrap().is_some())
        .collect();
    let body_bytes: u64 = retained.iter().map(|value| (value % 2) as u64).sum();
    assert!(!retained.is_empty());
    assert!(retained.len() as u64 <= capacity / OVERHEAD);
    assert_eq!(
        cache.accounted_bytes(),
        retained.len() as u64 * OVERHEAD + body_bytes
    );
    assert!(cache.peak_accounted_bytes() <= capacity);
}

#[test]
fn entry_overhead_covers_the_measured_entry_layout() {
    let pointer = size_of::<usize>();
    let lru_node = size_of::<CacheKey>() + size_of::<Arc<Entry>>() + 2 * pointer;
    let hash_string = key(0).hash.as_str().len();
    let shared_entry = 2 * pointer + size_of::<Entry>();
    let table_slot = ((2 * pointer + 1) * 16).div_ceil(7);
    let allocator_headers = 3 * 16;
    let measured = lru_node + hash_string + shared_entry + table_slot + allocator_headers;
    assert_eq!(measured, 279);
    assert!(measured as u64 <= OVERHEAD);
}
