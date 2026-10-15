//! Bounded tree metadata and binary cat-file decoding.

use std::collections::BTreeSet;

use crate::changes::fields;
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};

/// Independent tree and blob read budgets.
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    /// Maximum regular files returned or extracted.
    pub files: usize,
    /// Maximum total metadata nodes, including directories, links and submodules.
    pub nodes: usize,
    /// Maximum total regular-file bytes for extraction.
    pub bytes: usize,
    /// Maximum bytes in one regular file.
    pub blob: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            files: 100_000,
            nodes: 1_000_000,
            bytes: DEFAULT_OUTPUT_LIMIT,
            blob: DEFAULT_OUTPUT_LIMIT,
        }
    }
}

/// Mode stored by Git; links and submodules are never regular sources.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mode {
    /// Directory retained for direct-child and projection queries.
    Directory,
    /// Ordinary file.
    File,
    /// Executable file.
    Executable,
    /// Symbolic link blob.
    Symlink,
    /// Submodule commit.
    Submodule,
}

impl Mode {
    /// Whether this entry can supply source bytes.
    pub fn regular(self) -> bool {
        matches!(self, Self::File | Self::Executable)
    }
}

/// One leaf of a Git tree, retaining source spelling and file mode.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Entry {
    /// Repository-relative path.
    pub path: RepoPath,
    /// Immutable object id.
    pub object: ObjectId,
    /// File kind.
    pub mode: Mode,
    /// Uncompressed blob size; zero for submodules.
    pub size: usize,
}

pub(crate) fn parse(bytes: &[u8], limits: Limits) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    let mut seen = BTreeSet::new();
    let mut files = 0usize;
    for record in fields(bytes)? {
        if entries.len() >= limits.nodes {
            return Err(Error::NodeCount {
                limit: limits.nodes,
            });
        }
        let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
            return Err(Error::MalformedOutput);
        };
        let metadata = text(&record[..tab])?
            .split_ascii_whitespace()
            .collect::<Vec<_>>();
        let [mode, kind, object, size] = metadata.as_slice() else {
            return Err(Error::MalformedOutput);
        };
        let mode = match (*mode, *kind) {
            ("040000", "tree") => Mode::Directory,
            ("100644", "blob") => Mode::File,
            ("100755", "blob") => Mode::Executable,
            ("120000", "blob") => Mode::Symlink,
            ("160000", "commit") => Mode::Submodule,
            _ => return Err(Error::MalformedOutput),
        };
        if mode.regular() {
            files += 1;
            if files > limits.files {
                return Err(Error::FileCount {
                    limit: limits.files,
                });
            }
        }
        let size = if matches!(mode, Mode::Submodule | Mode::Directory) {
            0
        } else {
            match size.parse() {
                Ok(size) => size,
                Err(_) => return Err(Error::MalformedOutput),
            }
        };
        let Some(value) = candidate(&record[tab + 1..]) else {
            continue;
        };
        let path = RepoPath::parse(value)?;
        if !seen.insert(path.clone()) {
            return Err(Error::MalformedOutput);
        }
        entries.push(Entry {
            path,
            object: ObjectId::parse(object)?,
            mode,
            size,
        });
    }
    if !bytes.is_empty() && bytes.last() != Some(&0) {
        return Err(Error::MalformedOutput);
    }
    Ok(entries)
}

pub(crate) fn text(bytes: &[u8]) -> Result<&str> {
    match str::from_utf8(bytes) {
        Ok(text) => Ok(text),
        Err(_) => Err(Error::PathEncoding),
    }
}

pub(crate) fn blobs(bytes: &[u8], entries: &[Entry]) -> Result<Vec<Vec<u8>>> {
    let mut remaining = bytes;
    let mut result = Vec::with_capacity(entries.len());
    for entry in entries {
        let Some(end) = remaining.iter().position(|byte| *byte == b'\n') else {
            return Err(Error::MalformedOutput);
        };
        let expected = format!("{} blob {}", entry.object, entry.size);
        if remaining[..end] != *expected.as_bytes() {
            return Err(Error::MalformedOutput);
        }
        remaining = &remaining[end + 1..];
        if remaining.len() <= entry.size || remaining[entry.size] != b'\n' {
            return Err(Error::MalformedOutput);
        }
        result.push(remaining[..entry.size].to_vec());
        remaining = &remaining[entry.size + 1..];
    }
    if !remaining.is_empty() {
        return Err(Error::MalformedOutput);
    }
    Ok(result)
}

pub(crate) fn candidate(bytes: &[u8]) -> Option<&str> {
    match str::from_utf8(bytes) {
        Ok(value) if value.ends_with('/') => {
            tracing::trace!(path = value, "skipping a directory candidate");
            None
        }
        Ok(value) => Some(value),
        Err(_) => {
            tracing::trace!("skipping a non-UTF-8 Git path");
            None
        }
    }
}
