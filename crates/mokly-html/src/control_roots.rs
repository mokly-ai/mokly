//! Validate and annotate one physical control root through ownership regions.

use mokly_model::catalogue::SourceLocation;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Element, Node};

/// Mark exactly one rendered root as a logical control.
pub(crate) fn mark(nodes: &mut [Node], target: &str, fragment: Option<&str>) -> Result<()> {
    if root_count(nodes) != 1 {
        return Err(invalid(
            Code::HtmlAttribute,
            "MockLink child control must render exactly one root element",
        ));
    }
    let root = first_root(nodes).ok_or_else(|| {
        invalid(
            Code::HtmlAttribute,
            "MockLink child control has no root element",
        )
    })?;
    root.set("to", target);
    if let Some(fragment) = fragment {
        root.set("fragment", fragment);
    }
    Ok(())
}

fn root_count(nodes: &[Node]) -> usize {
    nodes
        .iter()
        .map(|node| match node {
            Node::Region { children, .. } => root_count(children),
            Node::Comment(_) => 0,
            Node::Text(text) if text.trim().is_empty() => 0,
            Node::Element(_) => 1,
            _ => 2,
        })
        .sum()
}

fn first_root(nodes: &mut [Node]) -> Option<&mut Element> {
    for node in nodes {
        match node {
            Node::Element(element) => return Some(element),
            Node::Region { children, .. } => {
                if let Some(element) = first_root(children) {
                    return Some(element);
                }
            }
            _ => {}
        }
    }
    None
}

pub(crate) fn source(nodes: &mut [Node], source: Option<SourceLocation>) {
    if let Some(root) = first_root(nodes) {
        root.source = source;
    }
}
