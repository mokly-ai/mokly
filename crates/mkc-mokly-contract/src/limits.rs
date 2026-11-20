//! Inclusive protocol ceilings and immutable, clamped receiver quotas.

use crate::error::{ArtifactKind, Error, Limit, Result};

/// Requested quotas; convert to immutable, ceiling-clamped `Limits` before use.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Quotas {
    /// Compressed request bytes.
    pub compressed: u64,
    /// Tar bytes including framing.
    pub decompressed: u64,
    /// Regular file bytes.
    pub file: u64,
    /// Regular file count including metadata.
    pub files: usize,
    /// Upload envelope bytes.
    pub manifest: u64,
    /// Ownership marker bytes; 48 MiB holds the largest formatted schema 3
    /// marker: 19,999 entries of 2,186 bytes (a 1,024-byte path of quotation
    /// marks that each expand to two JSON bytes, a 64-byte hash and an
    /// eight-digit size) plus 42 framing bytes is 43,717,856.
    pub inventory: u64,
    /// Catalogue index bytes.
    pub index: u64,
    /// UTF-8 bytes per relative path.
    pub path: usize,
    /// Slash-separated segments per path.
    pub path_segments: usize,
    /// Distinct file and directory prefixes.
    pub prefixes: usize,
}

impl Default for Quotas {
    fn default() -> Self {
        Self {
            compressed: 100 * 1024 * 1024,
            decompressed: 512 * 1024 * 1024,
            file: 64 * 1024 * 1024,
            files: 20_000,
            manifest: 16 * 1024,
            inventory: 48 * 1024 * 1024,
            index: 8 * 1024 * 1024,
            path: 1024,
            path_segments: 64,
            prefixes: 65_536,
        }
    }
}

/// Valid receiver limits; callers cannot raise ceilings or mutate stored quotas.
///
/// ```compile_fail
/// use mkc_mokly_contract::limits::Limits;
/// Limits::default().file = u64::MAX;
/// ```
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Limits {
    quotas: Quotas,
}

impl Limits {
    /// Clamp every requested quota to the documented receiver ceiling.
    pub fn lowered(requested: Quotas) -> Self {
        let ceiling = Quotas::default();
        Self {
            quotas: Quotas {
                compressed: requested.compressed.min(ceiling.compressed),
                decompressed: requested.decompressed.min(ceiling.decompressed),
                file: requested.file.min(ceiling.file),
                files: requested.files.min(ceiling.files),
                manifest: requested.manifest.min(ceiling.manifest),
                inventory: requested.inventory.min(ceiling.inventory),
                index: requested.index.min(ceiling.index),
                path: requested.path.min(ceiling.path),
                path_segments: requested.path_segments.min(ceiling.path_segments),
                prefixes: requested.prefixes.min(ceiling.prefixes),
            },
        }
    }

    /// Copy the effective quotas without permitting mutation of these limits.
    pub fn quotas(self) -> Quotas {
        self.quotas
    }

    /// Compressed request bytes.
    pub fn compressed(self) -> u64 {
        self.quotas.compressed
    }

    /// Tar bytes including framing.
    pub fn decompressed(self) -> u64 {
        self.quotas.decompressed
    }

    /// Regular file bytes.
    pub fn file(self) -> u64 {
        self.quotas.file
    }

    /// Regular file count including metadata.
    pub fn files(self) -> usize {
        self.quotas.files
    }

    /// Upload envelope bytes.
    pub fn manifest(self) -> u64 {
        self.quotas.manifest
    }

    /// Ownership inventory bytes.
    pub fn inventory(self) -> u64 {
        self.quotas.inventory
    }

    /// Catalogue index bytes.
    pub fn index(self) -> u64 {
        self.quotas.index
    }

    /// UTF-8 bytes per relative path.
    pub fn path(self) -> usize {
        self.quotas.path
    }

    /// Slash-separated segments per path.
    pub fn path_segments(self) -> usize {
        self.quotas.path_segments
    }

    /// Distinct file and directory prefixes.
    pub fn prefixes(self) -> usize {
        self.quotas.prefixes
    }

    pub(crate) fn check_file(self, size: u64, artifact: Option<ArtifactKind>) -> Result<()> {
        if size > self.file() {
            return Err(Error::TooLarge { limit: Limit::File });
        }
        let (maximum, limit) = match artifact {
            Some(ArtifactKind::Envelope) => (self.manifest(), Limit::Manifest),
            Some(ArtifactKind::Inventory) => (self.inventory(), Limit::Inventory),
            Some(ArtifactKind::Index) => (self.index(), Limit::Index),
            None => return Ok(()),
        };
        if size > maximum {
            return Err(Error::TooLarge { limit });
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/limits_tests.rs"]
mod limits_tests;
