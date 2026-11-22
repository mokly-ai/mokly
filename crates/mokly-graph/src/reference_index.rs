//! One generation keeps the first parsed edges of each referenced HTML or CSS file.
//! Inline style texts reuse the scans of a style memo that the index receives.

use std::collections::BTreeMap;
use std::collections::btree_map::Entry;
use std::sync::{Arc, Mutex};

use mokly_css::reference_cache::{MemoryReferenceCache, ReferenceCache};
use mokly_css::syntax::Reference;

use crate::comparison_proof::ContentIdentity;
use crate::delivery_inputs::STYLE_REFERENCE_BYTES;
use crate::error::Result;
use crate::resource_edges;

/// Object-safe cache of owner-neutral reference edges. It also reads the inline style
/// scans of a style memo.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReferenceIndexMock))]
pub trait ReferenceIndex: Send + Sync {
    /// Atomically read cached edges and the identity that actually supplied them.
    fn get_identified(&self, path: &str) -> Option<ReferenceEdges> {
        self.get(path).map(|urls| ReferenceEdges {
            urls,
            identity: None,
        })
    }
    /// Parse edges with the identity of their actual source read.
    fn parse_identified(
        &self,
        path: &str,
        bytes: &[u8],
        _identity: Option<ContentIdentity>,
    ) -> Result<ReferenceEdges> {
        Ok(ReferenceEdges {
            urls: self.parse(path, bytes)?,
            identity: None,
        })
    }
    /// Read a previously parsed edge set without reading source bytes again.
    fn get(&self, path: &str) -> Option<Vec<String>>;
    /// Parse and retain one file. Equal races reuse the first stored result.
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>>;
    /// The references of one inline style text, equal to a direct scan.
    fn style_references(&self, source: &str) -> Arc<[Reference]>;
}

/// Generation-scoped edge cache, discarded with its source and policy view.
pub struct MemoryReferenceIndex {
    edges: Mutex<BTreeMap<String, Arc<ReferenceEdges>>>,
    styles: Arc<dyn ReferenceCache>,
}

/// Parsed edges and their exact source receipt, selected by one cache operation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReferenceEdges {
    /// First stored reference edges, even when another parse loses a race.
    pub urls: Vec<String>,
    /// Identity of those edges' source; absent when their source is unknown.
    pub identity: Option<ContentIdentity>,
}

impl MemoryReferenceIndex {
    /// Create an empty index that reads inline style scans through `styles`.
    pub fn new(styles: Arc<dyn ReferenceCache>) -> Self {
        Self {
            edges: Mutex::default(),
            styles,
        }
    }

    fn cached(&self, path: &str) -> Option<Arc<ReferenceEdges>> {
        self.edges
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(path)
            .cloned()
    }
}

impl Default for MemoryReferenceIndex {
    fn default() -> Self {
        Self::new(Arc::new(MemoryReferenceCache::new(STYLE_REFERENCE_BYTES)))
    }
}

impl ReferenceIndex for MemoryReferenceIndex {
    fn get_identified(&self, path: &str) -> Option<ReferenceEdges> {
        self.cached(path).map(|first| first.as_ref().clone())
    }
    fn get(&self, path: &str) -> Option<Vec<String>> {
        self.get_identified(path).map(|edges| edges.urls)
    }
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>> {
        Ok(self.parse_identified(path, bytes, None)?.urls)
    }
    fn parse_identified(
        &self,
        path: &str,
        bytes: &[u8],
        identity: Option<ContentIdentity>,
    ) -> Result<ReferenceEdges> {
        if let Some(first) = self.cached(path) {
            return Ok(first.as_ref().clone());
        }
        let parsed = resource_edges::urls(path, bytes)
            .map(|urls| Arc::new(ReferenceEdges { urls, identity }));
        let path = path.to_owned();
        let first = {
            let mut edges = self.edges.lock().unwrap_or_else(|error| error.into_inner());
            match edges.entry(path) {
                Entry::Occupied(entry) => entry.get().clone(),
                Entry::Vacant(entry) => entry.insert(parsed?).clone(),
            }
        };
        Ok(first.as_ref().clone())
    }
    fn style_references(&self, source: &str) -> Arc<[Reference]> {
        self.styles.references(source)
    }
}

#[cfg(test)]
#[path = "_tests_/reference_receipt_tests.rs"]
mod reference_receipt_tests;
