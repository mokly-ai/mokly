//! Generation-scoped source inputs keep eviction reconstruction deterministic.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_model::material::digest;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{Child, Node, SourceTree};

/// Read-once source view for graph inputs, consumed as `dyn SourceTree`.
/// Public HTTP reads must use the live tree and recheck confinement separately.
pub struct SourceSnapshot {
    source: Arc<dyn SourceTree>,
    reads: Mutex<BTreeMap<PathBuf, Arc<ReadCell>>>,
    nodes: Mutex<BTreeMap<PathBuf, Option<Node>>>,
    directories: Mutex<BTreeMap<PathBuf, Vec<Child>>>,
    digests: Mutex<BTreeMap<PathBuf, Arc<DigestCell>>>,
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
        }
    }
}

impl SourceTree for SourceSnapshot {
    fn digest(&self, path: &Path) -> Result<String> {
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
            None => self.source.digest(path)?,
        };
        *retained = Some(value.clone());
        Ok(value)
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
        *value = Some(Arc::clone(&bytes));
        Ok(bytes)
    }
}
