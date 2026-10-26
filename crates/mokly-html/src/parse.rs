//! Authored and delivered HTML parsing through the shared token pipeline.

use crate::pipeline;
use crate::serialize;
use crate::tree::{self, Node};

/// Parse complete HTML bytes delivered by a document source.
pub fn delivered_document(source: &str) -> Vec<Node> {
    let nodes = pipeline::delivered_document(source);
    if terminal_text(&nodes) {
        pipeline::delivered_document(&serialize::html(&nodes))
    } else {
        nodes
    }
}

/// Parse an HTML fragment delivered by a document source.
pub fn delivered_fragment(source: &str) -> Vec<Node> {
    let nodes = pipeline::delivered_fragment(source);
    if terminal_text(&nodes) {
        pipeline::delivered_fragment(&serialize::html(&nodes))
    } else {
        nodes
    }
}

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
    let nodes = pipeline::authored_document(source, path, base_line, base_column);
    repair_authored(nodes, |serialized| {
        pipeline::authored_document(serialized, path, 1, 1)
    })
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
    let nodes = pipeline::authored_fragment(source, path, base_line, base_column);
    repair_authored(nodes, |serialized| {
        pipeline::authored_fragment(serialized, path, 1, 1)
    })
}

fn repair_authored(nodes: Vec<Node>, reparsed: impl FnOnce(&str) -> Vec<Node>) -> Vec<Node> {
    if !terminal_text(&nodes) {
        return nodes;
    }
    let mut positions = Vec::new();
    for node in tree::walk(&nodes) {
        let Node::Element(element) = node else {
            continue;
        };
        let plaintext = element.is_html() && element.name == "plaintext";
        positions.push((element.source.clone(), element.origin.clone()));
        if plaintext {
            break;
        }
    }
    let mut repaired = reparsed(&serialize::html(&nodes));
    let mut pending: Vec<_> = repaired.iter_mut().rev().collect();
    let mut index = 0;
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            if let Some((source, origin)) = positions.get(index) {
                element.source = source.clone();
                element.origin = origin.clone();
            }
            let stop = element.is_html() && element.name == "plaintext";
            index += 1;
            if stop {
                break;
            }
        }
        if let Some(children) = node.children_mut() {
            pending.extend(children.iter_mut().rev());
        }
    }
    repaired
}
