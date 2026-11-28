//! Stored reads wait while two parsed indexes still occupy their slots.

#![allow(clippy::unwrap_used)]

use std::future::Future;
use std::pin::pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::task::{Context, Poll, Waker};

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::stored_index::{BoundedStoredIndexReader, StoredIndexReader};

#[test]
fn a_third_read_waits_until_one_parsed_index_is_dropped() {
    let bytes = include_bytes!("../../../mkc-mokly-contract/fixtures/index-v9.json");
    let key = BlobKey {
        hash: BlobHash::digest(bytes),
        incarnation: Uuid::from_u128(1),
    };
    let loads = Arc::new(AtomicUsize::new(0));
    let reader = BoundedStoredIndexReader::new(Arc::new(Unimock::new(
        FileStoreMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let loads = loads.clone();
                move |_, _| {
                    loads.fetch_add(1, Ordering::Relaxed);
                    Ok(Some(bytes.to_vec()))
                }
            }))
            .n_times(3),
    )));
    let first = reader.load(&key).unwrap().unwrap();
    let mut third = pin!(reader.load_when_ready(&key));
    let mut context = Context::from_waker(Waker::noop());
    {
        let second = reader.load(&key).unwrap().unwrap();
        assert!(
            third.as_mut().poll(&mut context).is_pending(),
            "the third read finished with both parsed indexes alive"
        );
        assert_eq!(loads.load(Ordering::Relaxed), 2);
        assert_eq!(second.index().current_screens().len(), 2);
    }
    assert!(
        matches!(third.poll(&mut context), Poll::Ready(Ok(Some(index))) if index.index().current_screens().len() == 2)
    );
    assert_eq!(loads.load(Ordering::Relaxed), 3);
    assert_eq!(first.index().current_screens().len(), 2);
}
