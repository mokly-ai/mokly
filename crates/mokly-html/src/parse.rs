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
#[expect(dead_code, reason = "reserved for delivered differential probes")]
pub(crate) fn legacy_document(source: &str) -> Vec<Node> {
    legacy_document_with_mode(source, false)
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

#[cfg(test)]
#[expect(dead_code, reason = "reserved for fragment differential probes")]
pub(crate) fn legacy_fragment(source: &str) -> Vec<Node> {
    legacy_fragment_with_mode(source, false)
}

#[cfg(test)]
#[expect(
    dead_code,
    reason = "reserved for authored fragment differential probes"
)]
pub(crate) fn legacy_authored_fragment(source: &str) -> Vec<Node> {
    legacy_fragment_with_mode(source, true)
}

#[cfg(test)]
fn legacy_fragment_with_mode(source: &str, authored: bool) -> Vec<Node> {
    use html5ever::tendril::TendrilSink;
    use html5ever::tree_builder::TreeBuilderOpts;
    use html5ever::{ParseOpts, QualName, local_name, ns, parse_fragment};

    let nodes: Vec<Node> = parse_fragment(
        crate::html_arena::Arena::new(authored),
        ParseOpts {
            tree_builder: TreeBuilderOpts {
                scripting_enabled: false,
                ..Default::default()
            },
            ..Default::default()
        },
        QualName::new(None, ns!(html), local_name!("body")),
        Vec::new(),
        false,
    )
    .one(source)
    .into_iter()
    .flat_map(|mut node| match &mut node {
        Node::Element(element) if element.name == "html" => std::mem::take(&mut element.children),
        _ => vec![node],
    })
    .collect();
    if terminal_text(&nodes) {
        parse_fragment(
            crate::html_arena::Arena::new(authored),
            ParseOpts {
                tree_builder: TreeBuilderOpts {
                    scripting_enabled: false,
                    ..Default::default()
                },
                ..Default::default()
            },
            QualName::new(None, ns!(html), local_name!("body")),
            Vec::new(),
            false,
        )
        .one(serialize::html(&nodes))
        .into_iter()
        .flat_map(|mut node| match &mut node {
            Node::Element(element) if element.name == "html" => {
                std::mem::take(&mut element.children)
            }
            _ => vec![node],
        })
        .collect()
    } else {
        nodes
    }
}

/// Parse a complete authored page and attach source locations to its elements.
pub(crate) fn authored_document(
    source: &str,
    path: &str,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    pipeline::authored_document(source, path, base_line, base_column)
}

/// Parse an authored HTML fragment and attach source locations to its elements.
pub(crate) fn authored_fragment(
    source: &str,
    path: &str,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    pipeline::authored_fragment(source, path, base_line, base_column)
}
