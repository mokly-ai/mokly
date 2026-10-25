//! Checkout and blob access for dependency normalization and batched source reads.

use crate::changes::fields;
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, text};
use std::collections::BTreeSet;

/// Working bytes and the object identity after Git's clean conversion.
#[derive(Clone, Debug)]
pub struct WorkingFile {
    /// Exact working file bytes.
    pub bytes: Vec<u8>,
    /// Clean Git object hash, computed without writing an object.
    pub object: ObjectId,
}

impl GitRepository {
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
