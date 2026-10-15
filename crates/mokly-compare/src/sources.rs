//! Immutable source reads, ready for the render graph's source-tree adapter.

use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;

use mokly_git::error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::Repository;
use mokly_git::tree::{Entry, Limits};

use crate::error::{Error, GitResult, Result};

/// Confined source-file enumeration and byte reads.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourcesMock))]
pub trait Sources: Send + Sync {
    /// List regular leaves under exact repository roots; `None` means all files.
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>>;
    /// Read a regular source from its immutable side.
    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
}

/// Base source reader. It performs no disk extraction or package installation.
pub struct GitSources {
    /// Validated repository access.
    pub repository: Arc<dyn Repository>,
    /// Comparison base commit, independent of a moving ref.
    pub commit: ObjectId,
}

impl Sources for GitSources {
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>> {
        let mut entries = BTreeMap::new();
        for root in roots {
            for entry in self
                .repository
                .list(&self.commit, root.as_ref(), limits)
                .base()?
            {
                if entry.mode.regular() {
                    entries.insert(entry.path.clone(), entry);
                    if entries.len() > limits.files {
                        return Err(Error::Git {
                            source: error::Error::FileCount {
                                limit: limits.files,
                            },
                        });
                    }
                }
            }
        }
        Ok(entries.into_values().collect())
    }

    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        self.repository.read(&self.commit, path, limit).base()
    }
}

#[cfg(test)]
#[path = "_tests_/sources_tests.rs"]
mod sources_tests;

impl fmt::Debug for dyn Sources + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Sources")
    }
}
