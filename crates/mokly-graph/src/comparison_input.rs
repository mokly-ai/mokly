//! Retained-only inputs never read a source or report a speculative restore failure.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::sync::Arc;

use mokly_source_interface::tree::SourceTree;

use crate::cache::Artifact;
use crate::closure::Closure;
use crate::comparison_proof::ContentIdentity;
use crate::error::Result;
use crate::types::ComparisonDocument;

/// Prepared sources that a bundled import or stylesheet import reached.
pub struct ModuleImports<'a> {
    /// Ordered edges in the esbuild module graph, when the catalogue uses JavaScript.
    pub modules: Option<&'a BTreeMap<String, Vec<String>>>,
    /// CSS and bundled PostCSS imports, with their repository aliases.
    pub stylesheet_inputs: &'a BTreeSet<String>,
    /// Source tree of this generation for package manifest lookup.
    pub tree: &'a dyn SourceTree,
}

/// Exact codec input and captured closure of a document whose restore cannot fail.
/// This proof permits no source read, restoration, fallback, or diagnostic.
pub struct RetainedDocumentEvidence {
    /// Exact document bytes, annotated tree records, and every retained metadata field.
    pub identity: ContentIdentity,
    /// This side's validated closure, including its own policy results.
    pub closure: Closure,
}

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
