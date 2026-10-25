//! Confirmed plaintext consumes private ends without removing an own-page root.

use crate::normalization::{self, ATTRIBUTE, PREFIX, Repair};
use crate::tree::{self, Node, RegionKind};

/// Close the own root at its parsed parent boundary without serializing new bytes.
pub(crate) fn close_root(nodes: &mut Vec<Node>, repair: &Repair, plaintext: &str) {
    let Some(root) = root_owner(repair, plaintext) else {
        return;
    };
    let mut pending = vec![nodes];
    while let Some(children) = pending.pop() {
        let start = children
            .iter()
            .position(|node| normalization::marker(node) == Some((root, true)));
        if let Some(start) = start
            && !children
                .iter()
                .any(|node| normalization::marker(node) == Some((root, false)))
            && tree::walk(&children[start + 1..]).any(|node| {
                matches!(node, Node::Element(element) if element.is_html()
                    && element.name == "plaintext" && element.get(ATTRIBUTE) == Some(plaintext))
            })
        {
            children.push(Node::Comment(format!("{PREFIX}{root}:end")));
            return;
        }
        for node in children {
            if let Node::Element(element) = node {
                pending.push(&mut element.children);
            }
        }
    }
}

fn root_owner<'a>(repair: &'a Repair, plaintext: &str) -> Option<&'a str> {
    let mut owner = repair.elements.get(plaintext)?.owner.as_deref()?;
    loop {
        let placement = repair.regions.get(owner)?;
        if matches!(placement.region.kind, RegionKind::Root { .. }) {
            return Some(owner);
        }
        owner = placement.enclosing.as_deref()?;
    }
}
