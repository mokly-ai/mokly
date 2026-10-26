//! Authored and delivered HTML parsing through the shared token pipeline.

use crate::pipeline;
#[cfg(test)]
use crate::serialize;
use crate::tree::{self, Node};

/// Parse complete HTML bytes delivered by a document source.
pub fn delivered_document(source: &str) -> Vec<Node> {
    pipeline::delivered_document(source)
}

/// Parse an HTML fragment delivered by a document source.
pub fn delivered_fragment(source: &str) -> Vec<Node> {
    pipeline::delivered_fragment(source)
}

#[cfg(test)]
#[expect(dead_code, reason = "legacy parser support moves in R6")]
fn terminal_text(nodes: &[Node]) -> bool {
    tree::walk(nodes).any(|node| {
        matches!(node, Node::Element(element) if element.is_html() && element.name == "plaintext")
    })
}

#[cfg(test)]
pub(crate) fn legacy_authored_document(source: &str) -> Vec<Node> {
    legacy_document_with_mode(source, true)
}

#[cfg(test)]
fn legacy_document_with_mode(source: &str, authored: bool) -> Vec<Node> {
    use html5ever::tendril::TendrilSink;
    use html5ever::tree_builder::TreeBuilderOpts;
    use html5ever::{ParseOpts, parse_document};

    let nodes = parse_document(
        crate::html_arena::Arena::new(authored),
        ParseOpts {
            tree_builder: TreeBuilderOpts {
                scripting_enabled: false,
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .one(source);
    if terminal_text(&nodes) {
        parse_document(
            crate::html_arena::Arena::new(authored),
            ParseOpts {
                tree_builder: TreeBuilderOpts {
                    scripting_enabled: false,
                    ..Default::default()
                },
                ..Default::default()
            },
        )
        .one(serialize::html(&nodes))
    } else {
        nodes
    }
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
