//! One generation parses each referenced HTML or CSS file once, and scans each distinct
//! inline style text once.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_css::reference_cache::{MemoryReferenceCache, ReferenceCache};
use mokly_css::syntax::{self, Reference};

use crate::error::Result;
use crate::resource_edges;

/// The charge bound of the inline style scans of one generation. A scan with one short
/// reference costs about 350 bytes, so the bound keeps about 12,000 distinct texts.
const STYLE_REFERENCE_BYTES: usize = 4 * 1024 * 1024;

/// Object-safe cache of owner-neutral reference edges and inline style scans.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReferenceIndexMock))]
pub trait ReferenceIndex: Send + Sync {
    /// Read a previously parsed edge set without reading source bytes again.
    fn get(&self, path: &str) -> Option<Vec<String>>;
    /// Parse and retain one file. Equal races reuse the first stored result.
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>>;
    /// The references of one inline style text, equal to a direct scan. The default scans
    /// the text directly.
    fn style_references(&self, source: &str) -> Arc<[Reference]> {
        syntax::references(source).into()
    }
}

/// Generation-scoped edge cache, discarded with its source and policy view.
pub struct MemoryReferenceIndex {
    edges: Mutex<BTreeMap<String, Vec<String>>>,
    styles: Arc<dyn ReferenceCache>,
}

impl Default for MemoryReferenceIndex {
    fn default() -> Self {
        Self {
            edges: Mutex::default(),
            styles: Arc::new(MemoryReferenceCache::new(STYLE_REFERENCE_BYTES)),
        }
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
