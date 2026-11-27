//! Retained-only inputs never read a source or report a speculative restore failure.

use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;

use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_css::dependencies::ImportKind;
use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_source_interface::tree::SourceTree;

use crate::cache::Artifact;
use crate::closure::Closure;
use crate::comparison_proof::ContentIdentity;
use crate::error::Result;
use crate::types::ComparisonDocument;

/// Prepared sources loaded by JavaScript, CSS, and PostCSS.
pub struct ModuleImports<'a> {
    /// Bundled modules and their package-name import marks.
    pub javascript: Option<&'a JavaScriptGeneration>,
    /// Loaded stylesheet and PostCSS inputs, with their repository aliases.
    pub stylesheet_inputs: &'a BTreeMap<String, ImportKind>,
    /// Source tree of this generation for package manifest lookup.
    pub tree: &'a dyn SourceTree,
}

pub(crate) fn stylesheet_imports(
    imports: &mut BTreeMap<String, ImportKind>,
    root: &StylesheetRoot,
    bundle: &Bundle,
) {
    let stylesheets = bundle
        .inputs
        .keys()
        .filter(|path| !root.local_css || **path != root.path)
        .map(|path| {
            let package = bundle
                .imported_by
                .get(path)
                .is_some_and(|origin| origin.package_import);
            (
                path,
                if package {
                    ImportKind::Package
                } else {
                    ImportKind::File
                },
            )
        });
    let plugins = bundle
        .plugin_inputs
        .iter()
        .filter_map(|(path, origin)| origin.import.map(|kind| (path, kind)));
    for (path, kind) in stylesheets.chain(plugins) {
        imports
            .entry(path.clone())
            .and_modify(|present| *present = (*present).max(kind))
            .or_insert(kind);
    }
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
