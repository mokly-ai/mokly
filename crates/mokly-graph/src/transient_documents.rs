//! Transient document results that their callers own and the cache never keeps.

use std::sync::Arc;

use crate::cache::Artifact;
use crate::closure::Closure;

/// One transient comparison input, released after its worker encodes it.
#[derive(Debug)]
pub struct ComparisonDocument {
    /// Exact document bytes and composed tree.
    pub artifact: Arc<Artifact>,
    /// Validated authored resources and comparison evidence.
    pub closure: Closure,
}

/// A transient preview and its checked closure, never inserted as a saved document.
#[derive(Clone, Debug)]
pub struct TemporaryDocument {
    /// Serialized bytes and usage from the normal composition pipeline.
    pub artifact: Arc<Artifact>,
    /// Resources checked through the generation's public-file policy.
    pub closure: Closure,
}
