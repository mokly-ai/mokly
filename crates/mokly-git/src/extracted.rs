//! Converted base files read back from an extraction, with Git for the files it cannot prove.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::checkout::{admit, bounded};
use crate::checkout_output::conversion;
use crate::error::{Error, InternalError, Result};
use crate::fingerprint::Fingerprint;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

/// The regular files of one extraction with the fingerprint of each file when
/// it was taken, before base code could change a file.
#[derive(Clone, Debug)]
pub struct ExtractedFiles {
    root: PathBuf,
    fingerprints: BTreeMap<RepoPath, Fingerprint>,
}

impl ExtractedFiles {
    /// An extraction under `root` that proves no file; every read uses Git.
    pub fn unproved(root: PathBuf) -> Self {
        Self {
            root,
            fingerprints: BTreeMap::new(),
        }
    }

    /// The extraction root.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The number of files with a fingerprint.
    pub fn len(&self) -> usize {
        self.fingerprints.len()
    }

    /// Whether no file has a fingerprint.
    pub fn is_empty(&self) -> bool {
        self.fingerprints.is_empty()
    }
}

impl GitRepository {
    /// Fingerprints each confined regular file of `entries` under `root`. A
    /// file that the extraction does not hold or cannot read gets none.
    pub(crate) fn extracted_fingerprints(
        &self,
        root: &Path,
        entries: &[Entry],
    ) -> Result<ExtractedFiles> {
        let mut fingerprints = BTreeMap::new();
        for entry in entries.iter().filter(|entry| entry.mode.regular()) {
            match self.disk.fingerprint(root, &entry.path) {
                Ok(Some(fingerprint)) => {
                    fingerprints.insert(entry.path.clone(), fingerprint);
                }
                Ok(None) | Err(Error::NotRegular { .. }) => {}
                Err(Error::Internal(InternalError::Io { source })) => {
                    tracing::debug!(
                        path = %entry.path,
                        error = %source,
                        "extraction file cannot be read; reading through Git"
                    );
                }
                Err(error) => return Err(error),
            }
        }
        Ok(ExtractedFiles {
            root: root.to_owned(),
            fingerprints,
        })
    }

    /// Reads `entries` from the extraction. A file without a fingerprint, or
    /// whose fingerprint changed or cannot be read, reads through Git. The
    /// count and byte bounds and their errors equal those of a read through Git.
    pub(crate) fn extracted_read(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
        extracted: &ExtractedFiles,
    ) -> Result<Vec<Vec<u8>>> {
        admit(entries, limits)?;
        let mut files = Vec::with_capacity(entries.len());
        let mut lacking = Vec::new();
        for (index, entry) in entries.iter().enumerate() {
            let pinned = match extracted.fingerprints.get(&entry.path) {
                Some(expected) => {
                    self.disk
                        .read_pinned(&extracted.root, &entry.path, limits.blob, expected)
                }
                None => Ok(None),
            };
            match pinned {
                Ok(Some(bytes)) => files.push(bytes),
                Ok(None) | Err(Error::NotRegular { .. }) => {
                    files.push(Vec::new());
                    lacking.push(index);
                }
                Err(Error::Internal(InternalError::Io { source })) => {
                    tracing::debug!(
                        path = %entry.path,
                        error = %source,
                        "extraction file cannot be read; reading through Git"
                    );
                    files.push(Vec::new());
                    lacking.push(index);
                }
                Err(Error::ByteLimit { .. }) => {
                    return conversion(
                        Err(Error::ByteLimit { limit: limits.blob }),
                        std::slice::from_ref(entry),
                    );
                }
                Err(error) => return Err(error),
            }
        }
        if !lacking.is_empty() {
            let missing: Vec<_> = lacking
                .iter()
                .map(|index| entries[*index].clone())
                .collect();
            for (index, bytes) in lacking
                .into_iter()
                .zip(self.checkout_read(commit, &missing, limits)?)
            {
                files[index] = bytes;
            }
        }
        bounded(entries, files, limits)
    }

    /// Hashes one file of the extraction, or through Git when the extraction
    /// cannot prove or read its bytes.
    pub(crate) fn extracted_digest(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        extracted: &ExtractedFiles,
    ) -> Result<String> {
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: entry.path.to_string(),
            });
        }
        let pinned = match extracted.fingerprints.get(&entry.path) {
            Some(expected) => self
                .disk
                .digest_pinned(&extracted.root, &entry.path, expected),
            None => Ok(None),
        };
        match pinned {
            Ok(Some(hash)) => Ok(hash),
            Ok(None) | Err(Error::NotRegular { .. }) => self.checkout_digest(commit, entry),
            Err(Error::Internal(InternalError::Io { source })) => {
                tracing::debug!(
                    path = %entry.path,
                    error = %source,
                    "extraction file cannot be read; reading through Git"
                );
                self.checkout_digest(commit, entry)
            }
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/extracted_fallback_tests.rs"]
mod extracted_fallback_tests;
