//! Artifact IO uses the file-store trait and validates the published comparison.

use std::sync::Arc;

use mkc_file_store_interface::store::FileStoreMock;
use mkc_publications::stored_index::BoundedStoredIndexReader;
use unimock::{MockFn, Unimock, matching};

use crate::platform::error::Error;
use crate::viewer::artifacts::{Artifacts, StoredArtifacts};

use super::support::{INDEX_BYTES, file};

#[test]
fn accepted_comparison_bytes_decode_and_missing_or_corrupt_bytes_fail_closed() {
    for bytes in [Some(INDEX_BYTES.to_vec()), None, Some(b"{}".to_vec())] {
        let valid = bytes.as_ref().is_some_and(|bytes| bytes.len() > 2);
        let files = Unimock::new(
            FileStoreMock::get
                .next_call(matching!((key) if *key == &file().key))
                .returns(Ok(bytes)),
        );
        let reader: &dyn Artifacts = &StoredArtifacts {
            files: Arc::new(BoundedStoredIndexReader::new(Arc::new(files))),
        };
        let result = reader.index(&file());
        if valid {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::Internal(_))));
        }
    }
}
