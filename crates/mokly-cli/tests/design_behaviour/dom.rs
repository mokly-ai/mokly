//! Semantic HTML queries retain document order and ignore non-DOM region wrappers.

use mokly_html::tree::{Element, Node};

/// Enumerate physical elements in preorder through region annotations.
pub(super) fn elements(nodes: &[Node]) -> Vec<&Element> {
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    let mut elements = Vec::new();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            elements.push(element);
        }
        pending.extend(node.children().iter().rev());
    }
    elements
}

/// Match an exact class token without matching a similarly named class.
pub(super) fn class<'a>(nodes: &'a [Node], name: &str) -> Vec<&'a Element> {
    elements(nodes)
        .into_iter()
        .filter(|element| {
            element
                .get("class")
                .is_some_and(|classes| classes.split_ascii_whitespace().any(|value| value == name))
        })
        .collect()
}

/// Read normalized textual content in document order.
pub(super) fn text(nodes: &[Node]) -> String {
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    let mut text = String::new();
    while let Some(node) = pending.pop() {
        if let Node::Text(value) = node {
            text.push_str(value);
        }
        pending.extend(node.children().iter().rev());
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
