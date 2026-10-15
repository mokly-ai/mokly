//! Commit-pinned tree metadata and batched blob reads for a source-tree adapter.

use std::collections::BTreeMap;
use std::fmt;
use std::sync::{Arc, Mutex, OnceLock};

use mokly_git::error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::Repository;
use mokly_git::tree::{Entry, Limits};

use crate::error::{Error, GitResult, InternalError, Result};

/// Immutable metadata for every Git mode, including directories and links.
#[derive(Debug)]
pub struct TreeIndex {
    /// Exact repository-relative identities, ready for projection and child queries.
    pub entries: BTreeMap<RepoPath, Entry>,
}

/// Confined source enumeration and byte reads.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourcesMock))]
pub trait Sources: Send + Sync {
    /// List regular files below exact roots; `None` explicitly selects all files.
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>>;
    /// Read one regular source without querying tree metadata again.
    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
    /// Read selected source files in bounded cat-file batches.
    fn read_many(&self, paths: &[RepoPath], limits: Limits) -> Result<Vec<Vec<u8>>>;
    /// Return commit-pinned metadata for a later SourceTree adapter.
    fn index(&self) -> Result<Arc<TreeIndex>>;
}

/// Base reader. Compose a new reader and cancellation graph for each generation.
pub struct GitSources {
    repository: Arc<dyn Repository>,
    commit: ObjectId,
    index: OnceLock<Arc<TreeIndex>>,
    loading: Mutex<()>,
}

impl GitSources {
    /// Compose a reader without starting IO or extracting source files.
    pub fn new(repository: Arc<dyn Repository>, commit: ObjectId) -> Self {
        Self {
            repository,
            commit,
            index: OnceLock::new(),
            loading: Mutex::new(()),
        }
    }
}

impl Sources for GitSources {
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>> {
        if roots.is_empty() {
            return Ok(vec![]);
        }
        let index = self.index()?;
        let entries: Vec<_> = index
            .entries
            .values()
            .filter(|entry| {
                entry.mode.regular()
                    && roots
                        .iter()
                        .any(|root| root.as_ref().is_none_or(|root| entry.path.under(root)))
            })
            .cloned()
            .collect();
        if entries.len() > limits.files {
            return Err(Error::Git {
                source: error::Error::FileCount {
                    limit: limits.files,
                },
            });
        }
        Ok(entries)
    }

    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        self.read_many(
            std::slice::from_ref(path),
            Limits {
                bytes: limit,
                blob: limit,
                ..Limits::default()
            },
        )?
        .pop()
        .ok_or(Error::Git {
            source: error::Error::MalformedOutput,
        })
    }

    fn read_many(&self, paths: &[RepoPath], limits: Limits) -> Result<Vec<Vec<u8>>> {
        if paths.is_empty() {
            return Ok(vec![]);
        }
        let index = self.index()?;
        let entries = paths
            .iter()
            .map(|path| {
                index.entries.get(path).cloned().ok_or_else(|| Error::Git {
                    source: error::Error::MissingBlob {
                        path: path.to_string(),
                    },
                })
            })
            .collect::<Result<Vec<_>>>()?;
        self.repository.read_many(&entries, limits).base()
    }

    fn index(&self) -> Result<Arc<TreeIndex>> {
        if let Some(index) = self.index.get() {
            return Ok(Arc::clone(index));
        }
        let _loading = match self.loading.lock() {
            Ok(guard) => guard,
            Err(_) => return Err(InternalError::Poisoned.into()),
        };
        if let Some(index) = self.index.get() {
            return Ok(Arc::clone(index));
        }
        let entries = self
            .repository
            .list(&self.commit, None, Limits::default())
            .base()?;
        let index = Arc::new(TreeIndex {
            entries: entries
                .into_iter()
                .map(|entry| (entry.path.clone(), entry))
                .collect(),
        });
        let _ = self.index.set(Arc::clone(&index));
        Ok(index)
    }
}

impl fmt::Debug for dyn Sources + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Sources")
    }
}

#[cfg(test)]
#[path = "_tests_/sources_tests.rs"]
mod sources_tests;
