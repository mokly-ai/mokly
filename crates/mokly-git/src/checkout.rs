//! Checkout-converted bytes retain the user's real repository filter context.

use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::checkout_batch::{Active, FILTER_TIMEOUT, conversion_args, convert_entries, request};
use crate::checkout_files::{DirectoryFiles, MemoryFiles};
use crate::checkout_output::conversion;
use crate::error::{Error, IoResult, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

impl GitRepository {
    /// Reads one batch after checkout conversion. The converted bytes stay in
    /// memory within the batch byte bound and never touch the disk.
    pub(crate) fn checkout_read(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
    ) -> Result<Vec<Vec<u8>>> {
        validate_entries(entries, limits)?;
        for entry in entries {
            if entry.size > limits.blob {
                return Err(Error::ByteLimit { limit: limits.blob });
            }
        }
        if entries
            .iter()
            .fold(0usize, |total, entry| total.saturating_add(entry.size))
            > limits.bytes
        {
            return Err(Error::ByteLimit {
                limit: limits.bytes,
            });
        }
        if entries.is_empty() {
            return Ok(Vec::new());
        }
        self.ensure_checkout_objects(commit, entries)?;
        let mut files = MemoryFiles::new(entries.len());
        conversion(
            convert_entries(self, commit, entries, &mut files, limits.bytes),
            entries,
        )?;
        let mut total = 0usize;
        let mut result = Vec::with_capacity(entries.len());
        for (entry, bytes) in entries.iter().zip(files.into_files()) {
            if bytes.len() > limits.blob {
                return conversion(
                    Err(Error::ByteLimit { limit: limits.blob }),
                    std::slice::from_ref(entry),
                );
            }
            total = total.saturating_add(bytes.len());
            if total > limits.bytes {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
            result.push(bytes);
        }
        Ok(result)
    }

    pub(crate) fn checkout_digest(&self, commit: &ObjectId, entry: &Entry) -> Result<String> {
        validate_entries(std::slice::from_ref(entry), Limits::default())?;
        self.ensure_checkout_objects(commit, std::slice::from_ref(entry))?;
        let converted = self.converted_paths(commit, std::slice::from_ref(entry))?;
        let request = request(
            self,
            commit,
            conversion_args(entry, converted.contains(&entry.path)),
            Vec::new(),
        );
        conversion(
            self.runner.digest_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[("LC_ALL", "C".into())],
                FILTER_TIMEOUT,
            ),
            std::slice::from_ref(entry),
        )
    }

    pub(crate) fn checkout(
        &self,
        entries: &[Entry],
        commit: &ObjectId,
        limits: Limits,
    ) -> Result<Checkout> {
        validate_entries(entries, limits)?;
        self.ensure_checkout_objects(commit, entries)?;
        conversion(Checkout::new(self, commit, entries, limits.bytes), entries)
    }
}

fn validate_entries(entries: &[Entry], limits: Limits) -> Result<()> {
    if entries.len() > limits.files {
        return Err(Error::FileCount {
            limit: limits.files,
        });
    }
    for entry in entries {
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: entry.path.to_string(),
            });
        }
    }
    Ok(())
}

/// Converted files of one extraction batch in a private temporary directory,
/// removed on drop, so a large file never has to fit in memory.
pub(crate) struct Checkout {
    _root: tempfile::TempDir,
    files: BTreeMap<RepoPath, PathBuf>,
}

impl Checkout {
    fn new(
        repository: &GitRepository,
        commit: &ObjectId,
        entries: &[Entry],
        limit: usize,
    ) -> Result<Self> {
        let root = tempfile::Builder::new()
            .prefix("mokly-git-converted-")
            .tempdir()
            .git()?;
        let mut directory = DirectoryFiles::new(root.path(), entries.len());
        convert_entries(repository, commit, entries, &mut directory, limit)?;
        let mut files = BTreeMap::new();
        for (entry, path) in entries.iter().zip(directory.into_paths()) {
            let Some(path) = path else {
                return Err(Error::MalformedOutput);
            };
            files.insert(entry.path.clone(), path);
        }
        Ok(Self { _root: root, files })
    }

    pub(crate) fn file(&self, path: &RepoPath) -> Result<PathBuf> {
        self.files.get(path).cloned().ok_or(Error::MalformedOutput)
    }
}
