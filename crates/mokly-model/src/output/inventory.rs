//! Ordinary output bytes admitted once before identity and marker writing.

use std::collections::BTreeMap;

use bytes::Bytes;

use crate::output::artifact::File;
use crate::output::error::AdmissionError;
use crate::output::paths::{Paths, portable};
use crate::output::validation::FILE_LIMIT;

/// Portable, collision-free ordinary files with their admitted immutable bytes.
#[derive(Clone, Debug, Default)]
pub struct Inventory {
    files: BTreeMap<String, File>,
    paths: Paths,
}

impl Inventory {
    /// Admit one file before it can reach identity, staging, or marker writing.
    pub fn insert(&mut self, path: String, bytes: Bytes) -> Result<(), AdmissionError> {
        portable(&path)?;
        if bytes.len() > FILE_LIMIT {
            return Err(AdmissionError::TooLarge { path });
        }
        self.paths.record(&path)?;
        self.files.insert(path.clone(), File { path, bytes });
        Ok(())
    }

    /// Borrow the admitted files without permitting changes to paths or bytes.
    pub fn files(&self) -> impl ExactSizeIterator<Item = &File> {
        self.files.values()
    }

    /// Let the shared marker writer consume the admitted files.
    pub(super) fn into_files(self) -> Vec<File> {
        self.files.into_values().collect()
    }
}

#[cfg(test)]
#[path = "_tests_/inventory_tests.rs"]
mod inventory_tests;
