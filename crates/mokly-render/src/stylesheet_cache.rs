//! Byte-bounded cross-generation stylesheet reuse with dependency validation.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_css::error::Result;
use mokly_css::types::{Bundle, StylesheetBundler, StylesheetRoot};
use mokly_source_interface::tree::SourceTree;

use crate::input_stamp::InputStamp;
use crate::stylesheet_weight;

struct Record {
    stamp: InputStamp,
    bundle: Bundle,
    bytes: usize,
}

pub(crate) struct StylesheetCache {
    records: BTreeMap<String, Arc<Record>>,
    limit: usize,
}
impl Default for StylesheetCache {
    fn default() -> Self {
        Self {
            records: BTreeMap::new(),
            limit: 64 * 1024 * 1024,
        }
    }
}
impl StylesheetCache {
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            records: BTreeMap::new(),
            limit,
        }
    }
    pub(crate) fn empty_peer(&self) -> Self {
        Self::new(self.limit)
    }
    fn insert(&mut self, key: String, record: Arc<Record>) {
        let size = record.bytes + key.capacity();
        if size > self.limit {
            return;
        }
        self.records.remove(&key);
        let retained: usize = self
            .records
            .iter()
            .map(|(key, record)| key.capacity() + record.bytes)
            .sum();
        if retained + size > self.limit {
            self.records.clear();
        }
        self.records.insert(key, record);
    }
}

pub(crate) struct CachedStylesheets {
    pub(crate) inner: Arc<dyn StylesheetBundler>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) settings: String,
    pub(crate) shared: Arc<Mutex<StylesheetCache>>,
    pub(crate) local: Mutex<StylesheetCache>,
}

impl StylesheetBundler for CachedStylesheets {
    fn bundle(&self, root: &StylesheetRoot) -> Result<Bundle> {
        let key = format!("{}:{root:?}", self.settings);
        if let Some(record) = self
            .local
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .records
            .get(&key)
        {
            return Ok(record.bundle.clone());
        }
        let previous = self
            .shared
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .records
            .get(&key)
            .cloned();
        if let Some(previous) = previous
            && previous.stamp.current(self.tree.as_ref()) == previous.stamp
        {
            self.local
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(key, previous.clone());
            return Ok(previous.bundle.clone());
        }
        let bundle = self.inner.bundle(root)?;
        let mut stamp = InputStamp::default();
        for path in bundle.inputs.keys().chain(bundle.dependency_digests.keys()) {
            stamp.file(self.tree.as_ref(), self.root.join(path));
        }
        for asset in bundle.assets.values() {
            for path in asset.input_paths() {
                stamp.asset(self.tree.as_ref(), self.root.join(path));
            }
        }
        stamp.directories(self.tree.as_ref(), &self.root, &bundle.directories);
        let bytes =
            size_of::<Record>() + stylesheet_weight::bundle(&bundle) + stamp.retained_bytes();
        let record = Arc::new(Record {
            stamp,
            bundle,
            bytes,
        });
        self.shared
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key.clone(), record.clone());
        self.local
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key, record.clone());
        Ok(record.bundle.clone())
    }
}

#[cfg(test)]
#[path = "_tests_/stylesheet_cache_tests.rs"]
mod stylesheet_cache_tests;
