//! Trait boundary for streaming gzip/tar decoding without filesystem extraction.

use std::collections::BTreeMap;
use std::io::Read;
use std::sync::Arc;

use bytes::Bytes;
use mkc_upload_memory_interface::budget::UploadMemoryBudget;

use crate::error::Result;
use crate::limits::Limits;
use crate::manifest::UploadManifest;
use crate::scanned_archive::ScannedArchive;

/// Regular archive files captured under the protocol's bounded byte budget.
pub type ArchiveFiles = BTreeMap<String, Bytes>;

/// Single-owner body consumption; implementations must enforce framing limits.
#[cfg_attr(test, unimock::unimock(api = ReaderMock))]
pub trait TarballReader: Send + Sync {
    /// Decode an entire authenticated body without writing or extracting files.
    fn read(&self, source: &mut dyn Read, limits: Limits) -> Result<ScannedArchive>;
    /// Preserve a syntactically valid envelope read before a later rejection.
    /// The caller must authorize its repository and config before using identity.
    fn read_with_envelope(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive>;
}

/// POSIX USTAR/PAX and single-member gzip reader with weighted byte admission.
pub struct GzipTarReader {
    pub(crate) memory: Arc<dyn UploadMemoryBudget>,
}

impl GzipTarReader {
    /// Construct a reader that charges every retained regular-file body.
    pub fn new(memory: Arc<dyn UploadMemoryBudget>) -> Self {
        Self { memory }
    }
}

#[cfg(test)]
#[path = "_tests_/archive_tests.rs"]
mod archive_tests;

#[cfg(test)]
#[path = "_tests_/pax_tests.rs"]
mod pax_tests;

#[cfg(test)]
#[path = "_tests_/pax_global_tests.rs"]
mod pax_global_tests;
