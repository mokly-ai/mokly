//! One generation parses each referenced HTML or CSS file once.

use std::collections::BTreeMap;
use std::sync::Mutex;

use crate::error::Result;
use crate::resource_edges;

/// Object-safe cache of owner-neutral reference edges.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ReferenceIndexMock))]
pub trait ReferenceIndex: Send + Sync {
    /// Read a previously parsed edge set without reading source bytes again.
    fn get(&self, path: &str) -> Option<Vec<String>>;
    /// Parse and retain one file. Equal races reuse the first stored result.
    fn parse(&self, path: &str, bytes: &[u8]) -> Result<Vec<String>>;
}

/// Generation-scoped edge cache, discarded with its source and policy view.
#[derive(Default)]
pub struct MemoryReferenceIndex {
    edges: Mutex<BTreeMap<String, Vec<String>>>,
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
}
