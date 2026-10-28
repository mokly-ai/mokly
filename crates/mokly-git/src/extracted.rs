//! Converted base files read back from an extraction, with Git for the files that it lacks.

use std::path::Path;

use crate::checkout::{admit, bounded};
use crate::checkout_output::conversion;
use crate::error::{Error, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

impl GitRepository {
    /// Reads `entries` from the extraction of `commit` under `root`, which holds
    /// their checkout-converted bytes. A file that the extraction does not hold
    /// as a confined regular file reads through Git. The count and byte bounds
    /// and their errors equal those of a read through Git.
    pub(crate) fn extracted_read(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
        limits: Limits,
        root: &Path,
    ) -> Result<Vec<Vec<u8>>> {
        admit(entries, limits)?;
        let mut files = Vec::with_capacity(entries.len());
        let mut lacking = Vec::new();
        for (index, entry) in entries.iter().enumerate() {
            match self.disk.read(root, &entry.path, limits.blob) {
                Ok(Some(bytes)) => files.push(bytes),
                Ok(None) | Err(Error::NotRegular { .. }) => {
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

    /// Hashes one converted file of the extraction under `root`, or through Git
    /// when the extraction does not hold it as a confined regular file.
    pub(crate) fn extracted_digest(
        &self,
        commit: &ObjectId,
        entry: &Entry,
        root: &Path,
    ) -> Result<String> {
        if !entry.mode.regular() {
            return Err(Error::NotRegular {
                path: entry.path.to_string(),
            });
        }
        match self.disk.digest(root, &entry.path) {
            Ok(Some(hash)) => Ok(hash),
            Ok(None) | Err(Error::NotRegular { .. }) => self.checkout_digest(commit, entry),
            Err(error) => Err(error),
        }
    }
}
