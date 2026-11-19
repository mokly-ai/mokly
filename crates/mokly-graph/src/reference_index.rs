//! One generation parses each referenced HTML or CSS file once. Inline style texts reuse
//! the scans of a style memo that the index receives.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_css::reference_cache::{MemoryReferenceCache, ReferenceCache};
use mokly_css::syntax::Reference;

use crate::delivery_inputs::STYLE_REFERENCE_BYTES;
use crate::error::Result;
use crate::resource_edges;

/// Object-safe cache of owner-neutral reference edges. It also reads the inline style
/// scans of a style memo.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReferenceIndexMock))]
pub trait ReferenceIndex: Send + Sync {
    /// Read a previously parsed edge set without reading source bytes again.
    fn get(&self, path: &str) -> Option<Vec<String>>;
    /// Parse and retain one file. Equal races reuse the first stored result.
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>>;
    /// The references of one inline style text, equal to a direct scan.
    fn style_references(&self, source: &str) -> Arc<[Reference]>;
}

/// Generation-scoped edge cache, discarded with its source and policy view.
pub struct MemoryReferenceIndex {
    edges: Mutex<BTreeMap<String, Vec<String>>>,
    styles: Arc<dyn ReferenceCache>,
}

impl MemoryReferenceIndex {
    /// Create an empty index that reads inline style scans through `styles`.
    pub fn new(styles: Arc<dyn ReferenceCache>) -> Self {
        Self {
            edges: Mutex::default(),
            styles,
        }
    }
}

impl Default for MemoryReferenceIndex {
    fn default() -> Self {
        Self::new(Arc::new(MemoryReferenceCache::new(STYLE_REFERENCE_BYTES)))
    }
}

impl ReferenceIndex for MemoryReferenceIndex {
    fn get(&self, path: &str) -> Option<Vec<String>> {
        self.edges
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(path)
            .cloned()
    }
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>> {
        let mut edges = self.edges.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(urls) = edges.get(path) {
            return Ok(urls.clone());
        }
        let urls = resource_edges::urls(path, bytes)?;
        edges.insert(path.into(), urls.clone());
        Ok(urls)
    }
    fn style_references(&self, source: &str) -> Arc<[Reference]> {
        self.styles.references(source)
    }
}
