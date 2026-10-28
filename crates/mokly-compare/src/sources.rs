//! Commit-pinned tree metadata and batched blob reads for a source-tree adapter.

use std::collections::BTreeMap;
use std::fmt;
use std::sync::{Arc, Mutex};

use mokly_git::error;
use mokly_git::extracted::ExtractedFiles;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::Repository;
use mokly_git::tree::{Entry, Limits};

use crate::cache_types::Lease;
use crate::error::{Error, GitResult, Result};
use crate::extraction_snapshots::{ProcessSnapshots, Snapshots};
use crate::source_index::SourceIndex;

/// Immutable metadata for every Git mode, including directories and links.
#[derive(Clone, Debug, Default)]
pub struct TreeIndex {
    /// Exact repository-relative identities, ready for projection and child queries.
    pub entries: BTreeMap<RepoPath, Entry>,
}

/// Confined source enumeration and byte reads.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourcesMock))]
pub trait Sources: Send + Sync {
    /// Conversion warnings retained by extraction in the same repository session.
    fn warnings(&self) -> Vec<(String, String)> {
        Vec::new()
    }
    /// List regular files below exact roots; `None` explicitly selects all files.
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>>;
    /// Read one regular source without querying tree metadata again.
    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>>;
    /// Read selected source files in bounded cat-file batches.
    fn read_many(&self, paths: &[RepoPath], limits: Limits) -> Result<Vec<Vec<u8>>>;
    /// Load only exact requested paths; no descendants are read.
    fn ensure(&self, _paths: &[RepoPath]) -> Result<()> {
        Ok(())
    }
    /// Load one requested root and its descendants.
    fn expand(&self, _root: Option<&RepoPath>) -> Result<()> {
        Ok(())
    }
    /// Read regular files from a leased extraction of the same commit; the
    /// first attached lease stays for the life of the reader.
    fn attach(&self, _extraction: Arc<Lease>) -> Result<()> {
        Ok(())
    }
    /// Stream one blob's SHA-256 digest without retaining its bytes.
    fn digest(&self, path: &RepoPath) -> Result<String>;
    /// Return commit-pinned metadata for a later SourceTree adapter.
    fn index(&self) -> Result<Arc<TreeIndex>>;
}

/// Base reader. Compose a new reader and cancellation graph for each generation.
pub struct GitSources {
    pub(crate) repository: Arc<dyn Repository>,
    pub(crate) commit: ObjectId,
    limits: Limits,
    state: Mutex<SourceIndex>,
    pub(crate) snapshots: Arc<dyn Snapshots>,
    pub(crate) extraction: Mutex<Option<(Arc<Lease>, Arc<ExtractedFiles>)>>,
}

impl GitSources {
    /// Compose a reader without starting IO or extracting source files.
    pub fn new(repository: Arc<dyn Repository>, commit: ObjectId, limits: Limits) -> Self {
        Self::sharing(
            repository,
            commit,
            limits,
            Arc::new(ProcessSnapshots::default()),
        )
    }

    /// Compose a reader that shares extraction fingerprints with the other
    /// readers of the process.
    pub fn sharing(
        repository: Arc<dyn Repository>,
        commit: ObjectId,
        limits: Limits,
        snapshots: Arc<dyn Snapshots>,
    ) -> Self {
        Self {
            repository,
            commit,
            limits,
            state: Mutex::new(SourceIndex::default()),
            snapshots,
            extraction: Mutex::new(None),
        }
    }
}

impl Sources for GitSources {
    fn warnings(&self) -> Vec<(String, String)> {
        self.repository.conversion_warnings()
    }
    fn list(&self, roots: &[Option<RepoPath>], limits: Limits) -> Result<Vec<Entry>> {
        if roots.is_empty() {
            return Ok(vec![]);
        }
        for root in roots {
            self.expand(root.as_ref())?;
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
            return Err(Error::Limit {
                path: roots
                    .first()
                    .and_then(Option::as_ref)
                    .map_or(".", RepoPath::as_str)
                    .into(),
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
        let limits = Limits {
            files: limits.files.min(self.limits.files),
            nodes: limits.nodes.min(self.limits.nodes),
            blob: limits.blob.min(self.limits.blob),
            bytes: limits.bytes.min(self.limits.bytes),
        };
        self.ensure(paths)?;
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
        for entry in &entries {
            if !entry.mode.regular() {
                return Err(Error::Git {
                    source: error::Error::NotRegular {
                        path: entry.path.to_string(),
                    },
                });
            }
        }
        match self.extraction() {
            Some(files) => self
                .repository
                .read_extracted(&self.commit, &entries, limits, &files),
            None => self.repository.read_many(&self.commit, &entries, limits),
        }
        .at_path(paths.first().map_or(".", RepoPath::as_str))
    }

    fn index(&self) -> Result<Arc<TreeIndex>> {
        Ok(self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .index
            .clone())
    }

    fn ensure(&self, paths: &[RepoPath]) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let missing: Vec<_> = paths
            .iter()
            .filter(|path| !state.known.contains(*path) && !state.covered(path))
            .cloned()
            .collect();
        if missing.is_empty() {
            return Ok(());
        }
        let entries = self
            .repository
            .lookup(&self.commit, &missing, self.limits)
            .at_path(missing.first().map_or(".", RepoPath::as_str))?;
        Arc::make_mut(&mut state.index)
            .entries
            .extend(entries.into_iter().map(|entry| (entry.path.clone(), entry)));
        state.known.extend(missing);
        Ok(())
    }

    fn expand(&self, root: Option<&RepoPath>) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.roots.iter().any(|existing| {
            existing.is_none()
                || root.is_some_and(|root| {
                    existing
                        .as_ref()
                        .is_some_and(|existing| root.under(existing))
                })
        }) {
            return Ok(());
        }
        let entries = self
            .repository
            .list(&self.commit, root, self.limits)
            .at_path(root.map_or(".", RepoPath::as_str))?;
        Arc::make_mut(&mut state.index)
            .entries
            .extend(entries.into_iter().map(|entry| (entry.path.clone(), entry)));
        state.roots.push(root.cloned());
        Ok(())
    }

    fn digest(&self, path: &RepoPath) -> Result<String> {
        self.ensure(std::slice::from_ref(path))?;
        let index = self.index()?;
        let entry = index.entries.get(path).ok_or_else(|| Error::Git {
            source: error::Error::MissingBlob {
                path: path.to_string(),
            },
        })?;
        match self.extraction() {
            Some(files) => self
                .repository
                .digest_extracted(&self.commit, entry, &files),
            None => self.repository.digest(&self.commit, entry),
        }
        .at_path(path.as_str())
    }

    /// Lists the whole tree once and reads each extraction file that still
    /// matches its first fingerprint in the process.
    fn attach(&self, extraction: Arc<Lease>) -> Result<()> {
        self.attach_extraction(extraction)
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
