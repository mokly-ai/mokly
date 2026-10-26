//! Element walks with their ancestors, attributes, text, accessible names, and focus stops.

use mokly_html::tree::{Element, Node};

/// Every element below `nodes` in document order, with its element ancestors nearest first.
pub(super) fn with_ancestors(nodes: &[Node]) -> Vec<(&Element, Vec<&Element>)> {
    let mut found = Vec::new();
    collect(nodes, &[], &mut found);
    found
}

fn collect<'a>(
    nodes: &'a [Node],
    ancestors: &[&'a Element],
    found: &mut Vec<(&'a Element, Vec<&'a Element>)>,
) {
    for node in nodes {
        match node {
            Node::Element(element) => {
                found.push((element, ancestors.to_vec()));
                let mut own = vec![element];
                own.extend_from_slice(ancestors);
                collect(&element.children, &own, found);
            }
            other => collect(other.children(), ancestors, found),
        }
    }
}

/// Every element of `element`'s subtree, the element itself first.
pub(super) fn subtree(element: &Element) -> Vec<&Element> {
    let mut found = vec![element];
    for (inner, _) in with_ancestors(&element.children) {
        found.push(inner);
    }
    found
}

/// The value of the attribute `name`.
pub(super) fn attribute<'a>(element: &'a Element, name: &str) -> Option<&'a str> {
    element.get(name)
}

/// The class tokens of `element`.
pub(super) fn classes(element: &Element) -> Vec<&str> {
    attribute(element, "class")
        .unwrap_or("")
        .split_whitespace()
        .collect()
}

/// The descendant text of `nodes`, without comments.
pub(super) fn text(nodes: &[Node]) -> String {
    let mut value = String::new();
    for node in nodes {
        match node {
            Node::Text(text) => value.push_str(text),
            other => value.push_str(&text(other.children())),
        }
    }
    value
}

/// A link's accessible name: its `aria-label`, or else its collapsed text.
pub(super) fn accessible_name(element: &Element) -> String {
    attribute(element, "aria-label").map_or_else(
        || {
            text(&element.children)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        },
        str::to_owned,
    )
}

/// Whether sequential keyboard navigation stops at `element`.
pub(super) fn focus_stop(element: &Element) -> bool {
    let tabindex = attribute(element, "tabindex");
    if tabindex == Some("-1") || attribute(element, "disabled").is_some() {
        return false;
    }
    if element.name == "a" {
        return attribute(element, "href").is_some();
    }
    ["button", "input", "select", "textarea", "summary"].contains(&element.name.as_str())
        || tabindex.is_some()
}
