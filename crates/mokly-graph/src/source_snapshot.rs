//! Generation-scoped source inputs keep eviction reconstruction deterministic.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_model::material::digest;
use mokly_source_interface::error::Result;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, Node, SourceTree};

/// Read-once source view for graph inputs, consumed as `dyn SourceTree`.
/// Public HTTP reads must use the live tree and recheck confinement separately.
/// Reads and digests keep one cell per path. The map lock only finds the cell, and the
/// IO runs under the cell's own lock, so a slow read or digest never blocks other paths.
pub struct SourceSnapshot {
    source: Arc<dyn SourceTree>,
    reads: Mutex<BTreeMap<PathBuf, Arc<ReadCell>>>,
    nodes: Mutex<BTreeMap<PathBuf, Option<Node>>>,
    directories: Mutex<BTreeMap<PathBuf, Vec<Child>>>,
    digests: Mutex<BTreeMap<PathBuf, Arc<DigestCell>>>,
    retained_bytes: AtomicUsize,
}

#[cfg(test)]
#[path = "_tests_/snapshot_digest_tests.rs"]
mod snapshot_digest_tests;

#[derive(Default)]
struct DigestCell {
    value: Mutex<Option<String>>,
}

#[derive(Default)]
struct ReadCell {
    bytes: Mutex<Option<Arc<[u8]>>>,
}

impl SourceSnapshot {
    /// Start a fresh generation; no state survives into another snapshot.
    pub fn new(source: Arc<dyn SourceTree>) -> Self {
        Self {
            source,
            reads: Mutex::new(BTreeMap::new()),
            nodes: Mutex::new(BTreeMap::new()),
            directories: Mutex::new(BTreeMap::new()),
            digests: Mutex::new(BTreeMap::new()),
            retained_bytes: AtomicUsize::new(0),
        }
    }

    /// Total private payload bytes pinned once per source path; excludes metadata.
    pub fn retained_bytes(&self) -> usize {
        self.retained_bytes.load(Ordering::Relaxed)
    }
}

impl SourceSnapshot {
    fn digest_value(&self, path: &Path, unretained: bool) -> Result<String> {
        let cell = {
            let mut digests = self
                .digests
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            digests.entry(path.into()).or_default().clone()
        };
        let mut retained = cell.value.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(value) = &*retained {
            return Ok(value.clone());
        }
        let bytes = self
            .reads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(path)
            .cloned();
        let bytes = bytes.and_then(|cell| {
            cell.bytes
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone()
        });
        let value = match bytes {
            Some(bytes) => digest(&bytes),
            None if unretained => self.source.digest_unretained(path)?,
            None => self.source.digest(path)?,
        };
        *retained = Some(value.clone());
        Ok(value)
    }
}

impl SourceTree for SourceSnapshot {
    fn file_object(&self, path: &Path) -> Result<Option<String>> {
        self.source.file_object(path)
    }

    fn observe_inputs(&self, path: &Path, baselines: &BTreeSet<ReadBaseline>) -> Result<()> {
        self.source.observe_inputs(path, baselines)
    }
    fn observe_pinned_input(
        &self,
        path: &Path,
        baseline: &ReadBaseline,
        digest: Option<&str>,
    ) -> Result<()> {
        self.source.observe_pinned_input(path, baseline, digest)
    }
    fn observe_input(&self, path: &Path, baseline: &ReadBaseline) -> Result<()> {
        self.source.observe_input(path, baseline)
    }
    fn prefetch(&self, paths: &[PathBuf]) -> Result<()> {
        self.source.prefetch(paths)
    }
    fn read_public(&self, path: &Path) -> Result<Vec<u8>> {
        self.source.read_public(path)
    }
    fn open_stream(&self, path: &Path) -> Result<Box<dyn SourceStream>> {
        self.source.open_stream(path)
    }
    fn digest(&self, path: &Path) -> Result<String> {
        self.digest_value(path, false)
    }
    fn digest_unretained(&self, path: &Path) -> Result<String> {
        self.digest_value(path, true)
    }
    fn digest_unretained_batch(&self, paths: &[PathBuf]) -> Vec<Result<String>> {
        let cells: BTreeMap<_, _> = {
            let mut digests = self
                .digests
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            paths
                .iter()
                .map(|path| {
                    (
                        path.clone(),
                        digests.entry(path.clone()).or_default().clone(),
                    )
                })
                .collect()
        };
        let mut observed = {
            let mut pending = Vec::new();
            let mut results = BTreeMap::new();
            for (path, cell) in &cells {
                let mut value = cell.value.lock().unwrap_or_else(|error| error.into_inner());
                if let Some(hash) = &*value {
                    results.insert(path.clone(), Ok(hash.clone()));
                    continue;
                }
                let bytes = self
                    .reads
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .get(path)
                    .cloned();
                let bytes = bytes.and_then(|cell| {
                    cell.bytes
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .clone()
                });
                if let Some(bytes) = bytes {
                    let hash = digest(&bytes);
                    *value = Some(hash.clone());
                    results.insert(path.clone(), Ok(hash));
                } else {
                    pending.push((path, value));
                }
            }
            let pending_paths: Vec<_> = pending.iter().map(|(path, _)| (*path).clone()).collect();
            if !pending_paths.is_empty() {
                for ((path, mut value), result) in pending
                    .into_iter()
                    .zip(self.source.digest_unretained_batch(&pending_paths))
                {
                    if let Ok(hash) = &result {
                        *value = Some(hash.clone());
                    }
                    results.insert(path.clone(), result);
                }
            }
            results
        };
        paths
            .iter()
            .map(|path| match observed.get(path) {
                Some(Ok(hash)) => Ok(hash.clone()),
                _ => observed
                    .remove(path)
                    .unwrap_or_else(|| self.digest_unretained(path)),
            })
            .collect()
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let mut nodes = self.nodes.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(node) = nodes.get(path) {
            return Ok(node.clone());
        }
        let node = self.source.project(path)?;
        nodes.insert(path.into(), node.clone());
        Ok(node)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        let mut directories = self
            .directories
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(children) = directories.get(path) {
            return Ok(children.clone());
        }
        let children = self.source.children(path)?;
        directories.insert(path.into(), children.clone());
        Ok(children)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        Ok(self.read_shared(path)?.to_vec())
    }
    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        let cell = {
            let mut reads = self.reads.lock().unwrap_or_else(|error| error.into_inner());
            reads.entry(path.into()).or_default().clone()
        };
        let mut value = cell.bytes.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(bytes) = &*value {
            return Ok(Arc::clone(bytes));
        }
        let bytes = self.source.read_shared(path)?;
        self.retained_bytes
            .fetch_add(bytes.len(), Ordering::Relaxed);
        *value = Some(Arc::clone(&bytes));
        Ok(bytes)
    }
}

#[cfg(test)]
#[path = "_tests_/public_snapshot_tests.rs"]
mod public_snapshot_tests;
