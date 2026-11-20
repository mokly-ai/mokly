//! Read each durable catalogue detail once for the completing upload's index.

use mkc_mokly_contract::content::CatalogueContent;
use mkc_mokly_contract::error;
use mkc_mokly_contract::index::{CatalogueIndex, INDEX_PATH};
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::blob::PublicationFile;
use mkc_store_interface::publication::Publication;

use crate::completion_outcome::StoredIndex;
use crate::error::{DurabilityFailure, Error, ErrorResultExt, Result};
use crate::ingest::PublicationIngest;

pub(crate) trait ContentCheck {
    fn content(&self, attempt: &Publication) -> Result<StoredIndex>;
}

impl ContentCheck for PublicationIngest {
    /// Missing objects defer to the ready transaction because an overlapping
    /// completion can close an upload and release its references meanwhile.
    fn content(&self, attempt: &Publication) -> Result<StoredIndex> {
        let mut file = None;
        self.transactions.run(true, &mut |queries| {
            file = queries
                .publication_file(attempt.id, INDEX_PATH)
                .context("read stored catalogue index reference")?;
            Ok(())
        })?;
        let Some(file) = file else {
            return Ok(StoredIndex::Missing);
        };
        let Some(bytes) = self
            .files
            .get(&file.key)
            .context("read stored catalogue index")?
        else {
            return Ok(StoredIndex::Missing);
        };
        verify_size(&bytes, &file)?;
        let index = CatalogueIndex::parse(&bytes, Limits::default())
            .context("decode stored catalogue index")?;
        let content = match CatalogueContent::from_index(index, &bytes) {
            Ok(content) => content,
            Err(error) => return Err(rejected(error)),
        };
        let mut files = Vec::new();
        self.transactions.run(true, &mut |queries| {
            files = queries
                .publication_files(attempt.id)
                .context("read ownership-listed catalogue details")?;
            Ok(())
        })?;
        let mut details = content.details();
        for file in files {
            let Some(source) = details.source(&file.path) else {
                continue;
            };
            let Some(bytes) = self
                .files
                .get(&file.key)
                .context("read stored entry detail")?
            else {
                return Ok(StoredIndex::MissingDetail(file.path));
            };
            verify_size(&bytes, &file)?;
            if let Err(error) = details.validate(&bytes, source) {
                return Err(rejected(error));
            }
        }
        Ok(StoredIndex::Loaded(Box::new(content.into_index())))
    }
}

fn verify_size(bytes: &[u8], file: &PublicationFile) -> Result<()> {
    if file.size < 0 || bytes.len() as u64 != file.size as u64 {
        return Err(Error::internal(DurabilityFailure::StoredArtifactSize {
            path: file.path.clone(),
            expected: file.size,
            actual: bytes.len(),
        }));
    }
    Ok(())
}

fn rejected(error: error::Error) -> Error {
    match error {
        error::Error::UnsupportedVersion { artifact, version } => {
            Error::UnsupportedVersion { artifact, version }
        }
        error::Error::TooLarge { limit } => Error::TooLarge { limit },
        error::Error::Invalid { reason } => Error::InvalidBundle { reason },
        error::Error::Unavailable => Error::Unavailable,
        error::Error::Internal(source) => Error::internal(source),
    }
}
