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

    pub(crate) fn clean_hashes(&self, paths: &[RepoPath], limit: usize) -> Result<Vec<ObjectId>> {
        if paths.is_empty() {
            return Ok(vec![]);
        }
        let mut input = Vec::new();
        for path in paths {
            if self.disk.read(&self.directory, path, limit)?.is_none() {
                return Err(Error::MissingBlob {
                    path: path.to_string(),
                });
            }
            input.extend_from_slice(quoted_path(path).as_bytes());
            input.push(b'\n');
        }
        let output = self.command(
            &["hash-object", "--stdin-paths"],
            input,
            paths.len().saturating_mul(65),
        )?;
        let objects = text(&output)?
            .lines()
            .map(ObjectId::parse)
            .collect::<Result<Vec<_>>>()?;
        if objects.len() != paths.len() {
            return Err(Error::MalformedOutput);
        }
        Ok(objects)
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

fn quoted_path(path: &RepoPath) -> String {
    let mut output = String::from("\"./");
    for byte in path.as_str().bytes() {
        match byte {
            b'\\' | b'"' => {
                output.push('\\');
                output.push(char::from(byte));
            }
            32..=126 => output.push(char::from(byte)),
            _ => output.push_str(&format!("\\{byte:03o}")),
        }
    }
    output.push('"');
    output
}

#[cfg(test)]
#[path = "_tests_/access_tests.rs"]
mod access_tests;
