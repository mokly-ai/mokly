//! Checkout and blob access for dependency normalization and batched source reads.

use std::collections::BTreeSet;

use crate::blob_batches;
use crate::changes::fields;
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits, text};

/// Working bytes and the object identity after Git's clean conversion.
#[derive(Clone, Debug)]
pub struct WorkingFile {
    /// Exact working file bytes.
    pub bytes: Vec<u8>,
    /// Clean Git object hash, computed without writing an object.
    pub object: ObjectId,
}

impl GitRepository {
    pub(crate) fn load(&self, entries: &[Entry], limit: usize) -> Result<Vec<Vec<u8>>> {
        let total = entries
            .iter()
            .fold(0usize, |sum, entry| sum.saturating_add(entry.size));
        if total > limit {
            return Err(Error::ByteLimit { limit });
        }
        let mut result = Vec::new();
        for range in blob_batches::split(entries, blob_batches::BYTES, blob_batches::COUNT)? {
            let batch = &entries[range];
            let mut input = Vec::new();
            let mut bytes = 0usize;
            for entry in batch {
                input.extend_from_slice(entry.object.as_str().as_bytes());
                input.push(b'\n');
                bytes += blob_batches::cost(entry);
            }
            result.extend(tree::blobs(
                &self.command(&["cat-file", "--batch"], input, bytes)?,
                batch,
            )?);
        }
        Ok(result)
    }
    pub(crate) fn candidates(&self) -> Result<Vec<RepoPath>> {
        let output = self.command(
            &[
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let mut paths = BTreeSet::new();
        for field in fields(&output)? {
            if let Some(value) = tree::candidate(field) {
                paths.insert(RepoPath::parse(value)?);
            }
        }
        Ok(paths.into_iter().collect())
    }

    pub(crate) fn working_file(
        &self,
        path: &RepoPath,
        limit: usize,
    ) -> Result<Option<WorkingFile>> {
        let Some(bytes) = self.disk.read(&self.directory, path, limit)? else {
            return Ok(None);
        };
        let output = self.command(
            &["hash-object", "--path", path.as_str(), "--stdin"],
            bytes.clone(),
            1024,
        )?;
        Ok(Some(WorkingFile {
            bytes,
            object: ObjectId::parse(text(&output)?.trim())?,
        }))
    }

    pub(crate) fn read_entries(&self, entries: &[Entry], limits: Limits) -> Result<Vec<Vec<u8>>> {
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
            if entry.size > limits.blob {
                return Err(Error::ByteLimit { limit: limits.blob });
            }
        }
        self.load(entries, limits.bytes)
    }
}
