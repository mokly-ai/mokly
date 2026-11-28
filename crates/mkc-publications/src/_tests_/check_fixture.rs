//! Strict stored-index collaborators for neutral check-delivery scenarios.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use unimock::{Clause, MockFn, Unimock, matching};

use crate::stored_index::{BoundedStoredIndexReader, StoredIndexReader};

use super::index_fixture::current_document;

fn bytes() -> Vec<u8> {
    serde_json::to_vec(&current_document("disabled")).unwrap()
}

pub(super) fn reference(
    publication: PublicationId,
    project: ProjectId,
    calls: usize,
) -> impl Clause {
    BlobsMock::publication_file
        .each_call(&|matching| {
            matching.func(move |(id, path), _| *id == publication && *path == INDEX_PATH);
        })
        .answers_arc(Arc::new(move |_, _, _| {
            Ok(Some(PublicationFile {
                publication_id: publication,
                project_id: project,
                path: INDEX_PATH.into(),
                key: BlobKey {
                    hash: BlobHash::digest(&bytes()),
                    incarnation: publication.0,
                },
                content_type: "application/json".into(),
                size: bytes().len() as i64,
            }))
        }))
        .n_times(calls)
}

pub(super) fn files(calls: usize) -> Arc<dyn StoredIndexReader> {
    let store = Arc::new(Unimock::new(
        FileStoreMock::get
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(bytes())))
            .n_times(calls),
    ));
    Arc::new(BoundedStoredIndexReader::new(store))
}
