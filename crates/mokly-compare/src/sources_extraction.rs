//! A base reader that reads a leased extraction while its files keep their first fingerprints.

use std::sync::Arc;

use mokly_git::extracted::ExtractedFiles;

use crate::cache_types::Lease;
use crate::error::{GitResult, Result};
use crate::sources::{GitSources, Sources};

impl GitSources {
    pub(crate) fn extraction(&self) -> Option<Arc<ExtractedFiles>> {
        self.extraction
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .map(|(_, files)| files.clone())
    }

    /// Lists the whole tree once, as the extraction did, so a later projection
    /// needs no Git lookup. Reads then use each extraction file that still
    /// matches its first fingerprint in the process.
    pub(crate) fn attach_extraction(&self, extraction: Arc<Lease>) -> Result<()> {
        if self.extraction().is_some() {
            return Ok(());
        }
        self.expand(None)?;
        let entries: Vec<_> = self
            .index()?
            .entries
            .values()
            .filter(|entry| entry.mode.regular())
            .cloned()
            .collect();
        let files = match self.snapshots.get(&extraction.directory) {
            Some(files) => files,
            None => self.snapshots.keep(
                self.repository
                    .fingerprint_extracted(&extraction.directory, &entries)
                    .at_path(".")?,
            ),
        };
        let mut attached = self
            .extraction
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if attached.is_none() {
            *attached = Some((extraction, files));
        }
        Ok(())
    }
}
