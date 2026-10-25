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
    let mut count = 0;
    let mut pending: Vec<_> = nodes.iter().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Region { children, .. } => pending.extend(children),
            Node::Comment(_) => {}
            Node::Text(text) if text.trim().is_empty() => {}
            Node::Element(_) => count += 1,
            _ => count += 2,
        }
    }
    count
}

fn first_root(nodes: &mut [Node]) -> Option<&mut Element> {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => return Some(element),
            Node::Region { children, .. } => pending.extend(children.iter_mut().rev()),
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
