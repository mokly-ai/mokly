//! Seed object ceilings reach the HTTP transport before it reads a body.

#![allow(clippy::unwrap_used)]

use std::sync::{Arc, Mutex};

use bytes::Bytes;
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{HttpMock, Request, Response};
use mkc_file_store_interface::error::{Error, IntegrityError};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use unimock::{MockFn, Unimock, matching};

#[test]
fn seed_reads_cap_plan_and_blob_requests_before_buffering() {
    let limits = Arc::new(Mutex::new(Vec::new()));
    let recorded = limits.clone();
    let http = Unimock::new(
        HttpMock::execute
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: Request| {
                recorded.lock().unwrap().push(request.response_limit);
                Ok(Response {
                    status: 200,
                    body: Vec::new(),
                })
            }))
            .n_times(2),
    );
    let store: Arc<dyn SeedStore> = Arc::new(GcsFileStore::new(
        "https://storage.googleapis.test".to_owned(),
        "catalogue-fixture".to_owned(),
        None,
        Arc::new(http),
    ));
    let name = SeedName::new("local", "seed-status.json").unwrap();
    let Error::Internal(error) = store
        .put(&name, Bytes::from(vec![0; 64 * 1024 * 1024 + 1]))
        .unwrap_err();
    assert!(matches!(
        error.source_ref().downcast_ref::<IntegrityError>(),
        Some(IntegrityError::TooLarge)
    ));
    for file in [
        "catalogue/plan.tar.gz",
        "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ] {
        store
            .get(&SeedName::new("local", file).unwrap(), u64::MAX)
            .unwrap();
    }

    assert_eq!(
        *limits.lock().unwrap(),
        [100 * 1024 * 1024, 64 * 1024 * 1024]
    );
}
