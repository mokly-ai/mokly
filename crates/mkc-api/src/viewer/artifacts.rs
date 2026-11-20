//! Reads only previously accepted, content-addressed comparison artifacts.

use std::sync::Arc;

use mkc_file_store_interface::store::FileStore;
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::blob::PublicationFile;

use crate::platform::error::{Error, ErrorResultExt, Result};

#[unimock::unimock(api = [ArtifactsMock])]
pub(crate) trait Artifacts: Send + Sync {
    fn index(&self, file: &PublicationFile) -> Result<CatalogueIndex>;
}

pub(crate) struct StoredArtifacts {
    pub(crate) files: Arc<dyn FileStore>,
}

impl Artifacts for StoredArtifacts {
    fn index(&self, file: &PublicationFile) -> Result<CatalogueIndex> {
        let bytes = self
            .files
            .get(&file.key)
            .context("read accepted catalogue index bytes")?
            .ok_or_else(|| Error::internal(MissingArtifact))?;
        CatalogueIndex::parse(&bytes, Limits::default()).context("decode accepted catalogue index")
    }
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-api/viewer] accepted catalogue index bytes are missing")]
struct MissingArtifact;
