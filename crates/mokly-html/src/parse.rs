//! HTML5 parsing with a temporary parser tree, converted into owned nodes.

use html5ever::tendril::TendrilSink;
use html5ever::{QualName, local_name, ns, parse_document, parse_fragment};
use markup5ever_rcdom::{Handle, NodeData, RcDom};

use crate::tree::{Attribute, Element, Node};

/// Parse a complete document, including implied wrappers.
pub fn document(source: &str) -> Vec<Node> {
    let dom = parse_document(RcDom::default(), Default::default()).one(source);
    children(&dom.document)
}

/// Parse a body-context fragment with the standard HTML5 algorithm.
pub fn fragment(source: &str) -> Vec<Node> {
    let dom = parse_fragment(
        RcDom::default(),
        Default::default(),
        QualName::new(None, ns!(html), local_name!("body")),
        Vec::new(),
        false,
    )
    .one(source);
    let nodes = children(&dom.document);
    nodes
        .into_iter()
        .flat_map(|node| match node {
            Node::Element(element) if element.name == "html" => element.children,
            node => vec![node],
        })
        .collect()
}

fn children(handle: &Handle) -> Vec<Node> {
    handle
        .children
        .borrow()
        .iter()
        .filter_map(convert)
        .collect()
}

fn convert(handle: &Handle) -> Option<Node> {
    match &handle.data {
        NodeData::Document => None,
        NodeData::Doctype { name, .. } => Some(Node::Doctype(name.to_string())),
        NodeData::Text { contents } => Some(Node::Text(contents.borrow().to_string())),
        NodeData::Comment { contents } => Some(Node::Comment(contents.to_string())),
        NodeData::Element {
            name,
            attrs,
            template_contents,
            ..
        } => Some(Node::Element(Element {
            origin: None,
            navigation: None,
            source: None,
            name: name.local.to_string(),
            namespace: name.ns.to_string(),
            attributes: attrs
                .borrow()
                .iter()
                .map(|a| Attribute {
                    name: a.name.prefix.as_ref().map_or_else(
                        || a.name.local.to_string(),
                        |prefix| format!("{prefix}:{}", a.name.local),
                    ),
                    value: a.value.to_string(),
                })
                .collect(),
            children: template_contents
                .borrow()
                .as_ref()
                .map_or_else(|| children(handle), children),
        })),
        NodeData::ProcessingInstruction { .. } => None,
    }
}
