//! Immutable scan result whose paths already passed namespace validation.

use crate::archive::ArchiveFiles;
use crate::error::{ArtifactKind, Error, Limit, Result};
use crate::limits::Limits;
use crate::paths::Namespace;

/// Bounded regular files whose shared namespace a tarball reader already validated.
#[derive(Debug)]
pub struct ScannedArchive {
    pub(crate) files: ArchiveFiles,
    pub(crate) directories: usize,
}

impl ScannedArchive {
    /// Validate files supplied by an alternate reader without rebuilding their index later.
    /// The reader remains responsible for framing, transport limits and memory reservations.
    pub fn from_files(files: ArchiveFiles, limits: Limits) -> Result<Self> {
        if files.len() > limits.files() {
            return Err(Error::TooLarge {
                limit: Limit::FileCount,
            });
        }
        let mut namespace = Namespace::new(limits);
        let mut remaining = limits.decompressed();
        for (path, bytes) in &files {
            limits.check_file(bytes.len() as u64, ArtifactKind::at_path(path))?;
            if bytes.len() as u64 > remaining {
                return Err(Error::TooLarge {
                    limit: Limit::Decompressed,
                });
            }
            remaining -= bytes.len() as u64;
            namespace.insert(path, false)?;
        }
        Ok(Self {
            files,
            directories: 0,
        })
    }

    /// Exact regular-file bytes; mutation cannot bypass namespace validation.
    pub fn files(&self) -> &ArchiveFiles {
        &self.files
    }
}
