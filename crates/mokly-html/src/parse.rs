//! HTML5 parsing into the package-owned arena, with scripting disabled for frames.

use html5ever::tendril::TendrilSink;
use html5ever::tree_builder::TreeBuilderOpts;
use html5ever::{ParseOpts, QualName, local_name, ns, parse_document, parse_fragment};

use crate::html_arena::Arena;
use crate::tree::Node;

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
    parse_document(Arena::default(), options()).one(source)
}

/// Parse a body-context fragment with the standard HTML5 algorithm.
pub fn fragment(source: &str) -> Vec<Node> {
    parse_fragment(
        Arena::default(),
        options(),
        QualName::new(None, ns!(html), local_name!("body")),
        Vec::new(),
        false,
    )
    .one(source)
    .into_iter()
    .flat_map(|node| match node {
        Node::Element(element) if element.name == "html" => element.children,
        node => vec![node],
    })
    .collect()
}
