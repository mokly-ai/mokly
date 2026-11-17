//! Retained-only inputs never read a source or report a speculative restore failure.

use std::fmt;
use std::sync::Arc;

use crate::cache::Artifact;
use crate::closure::Closure;
use crate::error::Result;
use crate::types::ComparisonDocument;

/// A pure retained lookup either restores an input or defers its source fallback.
#[derive(Debug)]
pub enum RetainedComparisonInput {
    /// Decoded retained document and its captured closure.
    Ready(ComparisonDocument),
    /// One failed restore whose source work belongs to ordered consumption.
    Deferred(Box<dyn ComparisonFallback>),
}

/// Opaque failed-restore recipe, opened only by the ordered comparison consumer.
pub trait ComparisonFallback: Send + Sync {
    /// Log the failed restore and read the original source document once.
    fn document(&self, route: &str) -> Result<Arc<Artifact>>;
    /// Return the captured closure after the paired head document was read.
    fn closure(&self) -> Closure;
}

impl fmt::Debug for dyn ComparisonFallback {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ComparisonFallback")
    }
}
