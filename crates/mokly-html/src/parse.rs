//! HTML5 parsing into the package-owned arena, with scripting disabled for frames.

use std::mem;

use html5ever::tendril::TendrilSink;
use html5ever::tree_builder::TreeBuilderOpts;
use html5ever::{ParseOpts, QualName, local_name, ns, parse_document, parse_fragment};

use crate::html_arena::Arena;
use crate::serialize;
use crate::tree::{self, Node};

fn options() -> ParseOpts {
    ParseOpts {
        tree_builder: TreeBuilderOpts {
            scripting_enabled: false,
            ..Default::default()
        },
        ..Default::default()
    }
}

/// Parse a complete document, including implied wrappers.
pub fn document(source: &str) -> Vec<Node> {
    let nodes = raw_document(source);
    if terminal_text(&nodes) {
        raw_document(&serialize::html(&nodes))
    } else {
        nodes
    }
}

/// Parse a body-context fragment with the standard HTML5 algorithm.
pub fn fragment(source: &str) -> Vec<Node> {
    let nodes = raw_fragment(source);
    if terminal_text(&nodes) {
        raw_fragment(&serialize::html(&nodes))
    } else {
        nodes
    }
}

fn raw_document(source: &str) -> Vec<Node> {
    parse_document(Arena::default(), options()).one(source)
}

/// Plaintext consumes every later byte. One browser repair makes formatting
/// clones and foster-parented siblings into the literal serialized payload.
/// The serializer removes private annotations from reconstructed literal tags.
fn terminal_text(nodes: &[Node]) -> bool {
    tree::walk(nodes).any(|node| {
        matches!(node, Node::Element(element) if element.is_html() && element.name == "plaintext")
    })
}

fn raw_fragment(source: &str) -> Vec<Node> {
    parse_fragment(
        Arena::default(),
        options(),
        QualName::new(None, ns!(html), local_name!("body")),
        Vec::new(),
        false,
    )
    .one(source)
    .into_iter()
    .flat_map(|mut node| match &mut node {
        Node::Element(element) if element.name == "html" => mem::take(&mut element.children),
        _ => vec![node],
    })
    .collect()
}
