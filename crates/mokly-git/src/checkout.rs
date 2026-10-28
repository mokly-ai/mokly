//! Checkout-converted bytes retain the user's real repository filter context.

use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

use crate::checkout_batch::{
    Active, BATCH_BYTES, FILTER_TIMEOUT, batchable, conversion_args, convert, request,
};
use crate::checkout_output::conversion;
use crate::error::{Error, IoResult, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

impl GitRepository {
    /// Reads one batch after checkout conversion. The batch is written to its
    /// private directory and read back, and that directory is removed when this
    /// call returns, before the caller reads the next batch.
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
        let checkout = self.checkout(entries, commit, limits)?;
        let mut total = 0usize;
        let mut result = Vec::with_capacity(entries.len());
        for entry in entries {
            let bytes = conversion(
                checkout.read(&entry.path, limits.blob),
                std::slice::from_ref(entry),
            )?;
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

/// Converted files of one batch in a private temporary directory, removed on
/// drop. A batch of two or more files within 48 MiB converts in one filtered
/// `cat-file --batch` process. A single file, a path that starts with
/// whitespace, and every file of a larger batch stream alone straight to disk,
/// so a large file never has to fit in memory.
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
        let mut files = BTreeMap::new();
        let mut remaining = limit;
        let batch_bytes = entries
            .iter()
            .fold(0usize, |total, entry| total.saturating_add(entry.size));
        let converted = if batch_bytes <= BATCH_BYTES {
            let batch: Vec<_> = entries.iter().filter(|entry| batchable(entry)).collect();
            if batch.len() > 1 {
                let batch: Vec<_> = batch.into_iter().cloned().collect();
                let (paths, written) = convert(repository, commit, &batch, root.path(), remaining)?;
                remaining -= written;
                files.extend(batch.into_iter().map(|entry| entry.path).zip(paths));
            }
            None
        } else {
            Some(repository.converted_paths(commit, entries)?)
        };
        for (index, entry) in entries.iter().enumerate() {
            if files.contains_key(&entry.path) {
                continue;
            }
            let path = root.path().join(format!("single-{index}"));
            let mut output = fs::File::create(&path).git()?;
            let converted = converted
                .as_ref()
                .is_none_or(|converted| converted.contains(&entry.path));
            let request = request(
                repository,
                commit,
                conversion_args(entry, converted),
                Vec::new(),
            );
            repository
                .runner
                .stream_cancellable_with_environment_timeout(
                    &request,
                    &Active,
                    &[("LC_ALL", "C".into())],
                    FILTER_TIMEOUT,
                    &mut output,
                    remaining,
                )?;
            remaining = remaining.saturating_sub(output.metadata().git()?.len() as usize);
            files.insert(entry.path.clone(), path);
        }
        Ok(Self { _root: root, files })
    }

    pub(crate) fn file(&self, path: &RepoPath) -> Result<PathBuf> {
        self.files.get(path).cloned().ok_or(Error::MalformedOutput)
    }

    fn read(&self, path: &RepoPath, limit: usize) -> Result<Vec<u8>> {
        let file = self.file(path)?;
        if fs::metadata(&file).git()?.len() > limit as u64 {
            return Err(Error::ByteLimit { limit });
        }
        let mut bytes = Vec::new();
        fs::File::open(file)
            .git()?
            .take(limit.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .git()?;
        if bytes.len() > limit {
            return Err(Error::ByteLimit { limit });
        }
        Ok(bytes)
    }
}
