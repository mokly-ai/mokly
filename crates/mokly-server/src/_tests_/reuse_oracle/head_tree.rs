//! An in-memory repository and a render cache that counts each document's checked reads.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_graph::cache::{Artifact, CacheStats, MemoryCache, RenderCache};
use mokly_graph::key::NodeKey;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

pub(super) const ROOT: &str = "/repo";

/// Editable files below one root. Each generation reads it through its own snapshot.
#[derive(Default)]
pub(super) struct MemoryTree {
    files: Mutex<BTreeMap<PathBuf, Vec<u8>>>,
}

impl MemoryTree {
    pub(super) fn write(&self, path: &str, content: &str) {
        self.files
            .lock()
            .unwrap()
            .insert(Path::new(ROOT).join(path), content.as_bytes().to_vec());
    }

    pub(super) fn remove(&self, path: &str) {
        self.files
            .lock()
            .unwrap()
            .remove(&Path::new(ROOT).join(path));
    }

    fn directories(&self) -> BTreeSet<PathBuf> {
        let mut directories = BTreeSet::from([PathBuf::from(ROOT)]);
        for path in self.files.lock().unwrap().keys() {
            for parent in path.ancestors().skip(1) {
                if parent.starts_with(ROOT) {
                    directories.insert(parent.to_owned());
                }
            }
        }
        directories
    }
}

impl SourceTree for MemoryTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let kind = if self.files.lock().unwrap().contains_key(path) {
            FileKind::File
        } else if self.directories().contains(path) {
            FileKind::Directory
        } else {
            return Ok(None);
        };
        Ok(Some(Node {
            identity: path.into(),
            kind,
            lexical_kind: kind,
        }))
    }

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        let directories = self.directories();
        if !directories.contains(path) {
            return Err(missing(path));
        }
        let files = self.files.lock().unwrap();
        Ok(files
            .keys()
            .map(|path| (path, FileKind::File))
            .chain(directories.iter().map(|path| (path, FileKind::Directory)))
            .filter(|(candidate, _)| candidate.parent() == Some(path))
            .map(|(candidate, kind)| Child {
                name: candidate.file_name().unwrap().to_string_lossy().into(),
                kind,
            })
            .collect())
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        self.files
            .lock()
            .unwrap()
            .get(path)
            .cloned()
            .ok_or_else(|| missing(path))
    }
}

fn missing(path: &Path) -> SourceError {
    SourceError::Io {
        operation: "read memory fixture",
        path: path.into(),
        source: io::Error::from(io::ErrorKind::NotFound),
    }
}

/// Counts the inserts of each document key. Only a checked document read inserts on a hit.
/// A dropped key reads as absent until a later insert, like an evicted entry.
pub(super) struct CountingCache {
    inner: MemoryCache,
    inserts: Mutex<BTreeMap<NodeKey, usize>>,
    dropped: Mutex<BTreeSet<NodeKey>>,
}

impl CountingCache {
    pub(super) fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: MemoryCache::new(32 * 1024 * 1024, 0),
            inserts: Mutex::default(),
            dropped: Mutex::default(),
        })
    }

    pub(super) fn take_inserts(&self) -> BTreeMap<NodeKey, usize> {
        std::mem::take(&mut *self.inserts.lock().unwrap())
    }

    pub(super) fn drop_key(&self, key: &NodeKey) {
        self.dropped.lock().unwrap().insert(key.clone());
    }

    pub(super) fn holds(&self, key: &NodeKey) -> bool {
        self.contains(key)
    }
}

impl RenderCache for CountingCache {
    fn contains(&self, key: &NodeKey) -> bool {
        !self.dropped.lock().unwrap().contains(key) && self.inner.contains(key)
    }
    fn get(&self, key: &NodeKey) -> Option<Arc<Artifact>> {
        if self.dropped.lock().unwrap().contains(key) {
            return None;
        }
        self.inner.get(key)
    }
    fn insert(&self, key: NodeKey, value: Arc<Artifact>) {
        self.dropped.lock().unwrap().remove(&key);
        *self.inserts.lock().unwrap().entry(key.clone()).or_default() += 1;
        self.inner.insert(key, value);
    }
    fn stats(&self) -> CacheStats {
        self.inner.stats()
    }
}
