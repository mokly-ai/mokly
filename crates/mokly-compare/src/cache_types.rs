//! Cache boundaries and lease data shared by base preparation.

use std::fmt;
use std::path::{Path, PathBuf};

use mokly_platform::locks::FileLock;
use serde::{Deserialize, Serialize};

use crate::error::Result;

/// Independent extraction and dependency budgets.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Kind {
    /// Extracted immutable source trees.
    Sources,
    /// Installed immutable dependency sets.
    Dependencies,
}

impl Kind {
    pub(crate) fn directory(self) -> &'static str {
        match self {
            Self::Sources => "sources",
            Self::Dependencies => "dependencies",
        }
    }
}

/// Receipt written only after a cache entry is complete.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Receipt {
    /// Conservative retained byte count.
    pub bytes: u64,
    /// Monotonic access sequence under the namespace lock.
    pub used: u64,
}

/// One complete on-disk cache entry.
#[derive(Clone, Debug)]
pub struct Record {
    /// Content key.
    pub key: String,
    /// Completed entry metadata.
    pub receipt: Receipt,
}

/// Builder invoked for a missing entry under its exclusive entry lock.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BuilderMock))]
pub trait Builder: Send + Sync {
    /// Whether a completed build can be reused in a later generation.
    fn reusable(&self) -> bool {
        true
    }
    /// Populate a fresh `data` directory. Never modify the repository.
    fn build(&self, destination: &Path) -> Result<()>;
}

/// A cache result held against eviction until its lock guard is released.
pub struct Lease {
    /// Source root or package-install root.
    pub directory: PathBuf,
    /// Held entry lock. Callers keep the lease while they use the files.
    pub guard: Box<dyn FileLock>,
}

/// Byte-bounded cache access, separate from its filesystem implementation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CacheMock))]
pub trait Cache: Send + Sync {
    /// Maximum retained bytes in this namespace.
    fn capacity(&self, kind: Kind) -> u64;
    /// Open or build an immutable entry and retain its shared lease.
    fn get(&self, kind: Kind, key: &str, builder: &dyn Builder) -> Result<Lease>;
}

/// Filesystem boundary of cache orchestration and install size supervision.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StorageMock))]
pub trait Storage: Send + Sync {
    /// Check whether an installed dependency directory exists.
    fn directory(&self, path: &Path) -> Result<bool>;
    /// Ensure a real directory exists without traversing a cache symlink.
    fn prepare(&self, directory: &Path) -> Result<()>;
    /// List staging names so the caller removes only entries with a free lock.
    fn stages(&self, directory: &Path) -> Result<Vec<String>>;
    /// Validate a completed receipt against recounted data bytes.
    fn inspect(&self, entry: &Path, limit: u64) -> Result<Option<Receipt>>;
    /// Flush file data and directory metadata before publishing completion.
    fn synchronize(&self, directory: &Path) -> Result<()>;
    /// List completed and damaged entries without removing leased data.
    fn records(&self, entries: &Path) -> Result<Vec<Record>>;
    /// Update a receipt with atomic replacement.
    fn receipt(&self, entry: &Path, receipt: &Receipt) -> Result<()>;
    /// Update only the access sequence without durability flushes.
    fn touch(&self, entry: &Path, receipt: &Receipt) -> Result<()>;
    /// Rename an unleased entry into trash without traversing it.
    fn retire(&self, path: &Path, trash: &Path) -> Result<()>;
    /// Count bytes without following symbolic links; stop at the limit.
    fn size(&self, path: &Path, limit: u64) -> Result<u64>;
    /// Remove cache-owned data without following links, checking cancellation.
    fn remove(&self, path: &Path) -> Result<()>;
    /// Move a completed staging directory into its final name.
    fn publish(&self, stage: &Path, target: &Path) -> Result<()>;
    /// Copy regular source files to a fresh install directory under a byte limit.
    fn copy(&self, source: &Path, destination: &Path, limit: u64) -> Result<()>;
}

/// Terminal boundary. A process shares one reporter across both cache kinds.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReporterMock))]
pub trait Reporter: Send + Sync {
    /// Name the cache directory when it is first opened.
    fn opened(&self, directory: &Path);
}

impl fmt::Debug for dyn Builder + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Builder")
    }
}
