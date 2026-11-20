//! Transactional file reservation and ready completion boundaries.

use mkc_mokly_contract::bundle::PlanBundle;
use mkc_store_interface::blob::PublicationFile;
use mkc_store_interface::publication::{Publication, PublicationMetadata};

use crate::completion_outcome::StoredIndex;
use crate::error::Result;
use crate::ingest::{Ingested, UploadAuthorization};

mod finish;
mod reserve;

pub(crate) struct Prepared {
    pub(crate) files: Vec<PublicationFile>,
    pub(crate) pending: Vec<PublicationFile>,
    pub(crate) existing: Option<Publication>,
    pub(crate) file_count: usize,
    pub(crate) distinct_hashes: usize,
}

pub(crate) trait Reservation {
    fn reserve(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        bundle: &PlanBundle,
    ) -> Result<Prepared>;
}

pub(crate) trait Completion {
    fn finish(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        metadata: &PublicationMetadata,
        index: &StoredIndex,
    ) -> Result<Ingested>;
}
