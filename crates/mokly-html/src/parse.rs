//! Authored and delivered HTML parsing through the shared token pipeline.

use crate::pipeline;
use crate::tree::Node;

/// Parse complete HTML bytes delivered by a document source.
pub fn delivered_document(source: &str) -> Vec<Node> {
    pipeline::delivered_document(source)
}

/// Parse an HTML fragment delivered by a document source.
pub fn delivered_fragment(source: &str) -> Vec<Node> {
    pipeline::delivered_fragment(source)
}

/// Parse a complete authored page and attach source locations to its elements.
pub fn authored_document(source: &str, path: &str) -> Vec<Node> {
    authored_document_at(source, path, 1, 1)
}

/// Parse an authored page at a source body offset.
pub(crate) fn authored_document_at(
    source: &str,
    path: &str,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    pipeline::authored_document(source, path, base_line, base_column)
}

/// Parse an authored HTML fragment and attach source locations to its elements.
pub fn authored_fragment(source: &str, path: &str) -> Vec<Node> {
    authored_fragment_at(source, path, 1, 1)
}

/// Parse an authored fragment at a source body offset.
pub(crate) fn authored_fragment_at(
    source: &str,
    path: &str,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    pipeline::authored_fragment(source, path, base_line, base_column)
}

pub(crate) fn authored_fragment_unlocated(source: &str) -> Vec<Node> {
    pipeline::authored_fragment_unlocated(source)
}
