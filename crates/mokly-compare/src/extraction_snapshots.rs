//! Extraction fingerprints are taken once per process, before base code of the process runs.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_git::extracted::ExtractedFiles;

/// The fingerprints of each leased extraction in one process. The first
/// fingerprints of an extraction stay, so a later preparation still detects a
/// file that base code changed after the first lease.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SnapshotsMock))]
pub trait Snapshots: Send + Sync {
    /// The fingerprints kept for the extraction under `root`, if any.
    fn get(&self, root: &Path) -> Option<Arc<ExtractedFiles>>;
    /// Keep `files` unless fingerprints for their root are already kept, and
    /// return the kept fingerprints.
    fn keep(&self, files: ExtractedFiles) -> Arc<ExtractedFiles>;
}

/// Fingerprints kept in memory for the life of one process.
#[derive(Default)]
pub struct ProcessSnapshots {
    kept: Mutex<BTreeMap<PathBuf, Arc<ExtractedFiles>>>,
}

impl Snapshots for ProcessSnapshots {
    fn get(&self, root: &Path) -> Option<Arc<ExtractedFiles>> {
        self.kept
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(root)
            .cloned()
    }

    fn keep(&self, files: ExtractedFiles) -> Arc<ExtractedFiles> {
        self.kept
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(files.root().to_owned())
            .or_insert_with(|| Arc::new(files))
            .clone()
    }
}

#[cfg(test)]
#[path = "_tests_/extraction_snapshots_tests.rs"]
mod extraction_snapshots_tests;
