//! Immutable content keys and production HTTP transport composition for tests.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{AccessTokenMock, HttpFactory, ReqwestHttpFactory};
use mkc_file_store_interface::store::FileStore;
use unimock::{MockFn, Unimock, matching};

pub(crate) fn key(bytes: &[u8]) -> BlobKey {
    BlobKey::from_object_name(&format!(
        "sha256/{}/00000000-0000-7000-8000-000000000001",
        BlobHash::digest(bytes)
    ))
    .unwrap()
}

pub(crate) fn store(endpoint: String, prefix: Option<&str>) -> Arc<dyn FileStore> {
    Arc::new(GcsFileStore::new(
        endpoint,
        "catalogue-fixture".to_owned(),
        prefix.map(|value| value.parse().unwrap()),
        ReqwestHttpFactory
            .build(Arc::new(Unimock::new(
                AccessTokenMock::token
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok("fixture-oauth".to_owned())),
            )))
            .unwrap(),
    ))
}
