//! Reads only previously accepted, content-addressed comparison artifacts.

use std::sync::Arc;

use mkc_publications::stored_index::{LoadedIndex, StoredIndexReader};
use mkc_store_interface::blob::PublicationFile;

use crate::platform::error::{Error, ErrorResultExt, Result};

#[unimock::unimock(api = [ArtifactsMock])]
pub(crate) trait Artifacts: Send + Sync {
    fn index(&self, file: &PublicationFile) -> Result<LoadedIndex>;
}

pub(crate) struct StoredArtifacts {
    pub(crate) files: Arc<dyn StoredIndexReader>,
}

impl Artifacts for StoredArtifacts {
    fn index(&self, file: &PublicationFile) -> Result<LoadedIndex> {
        self.files
            .load(&file.key)
            .context("read accepted catalogue index")?
            .ok_or_else(|| Error::internal(MissingArtifact))
    }
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-api/viewer] accepted catalogue index bytes are missing")]
struct MissingArtifact;
