//! Filter ignore-wrapper attributes before composition evaluates them, and validate ignore ids.

use mokly_catalogue::html_tokens::reserved_navigation_attribute;
use mokly_catalogue::template_types::ignore_attribute_allowed;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Element, Node};

/// Keep the wrapper attributes that the authored parse keeps: the catalogue rule and the
/// reserved navigation names. Other elements keep all attributes.
pub(crate) fn filter_attributes(element: &mut Element) {
    filter_attributes_with_removed(element);
}

fn filter_attributes_with_removed(element: &mut Element) -> Vec<String> {
    let Element {
        name, attributes, ..
    } = element;
    let mut removed = Vec::new();
    attributes.retain(|attribute| {
        if ignore_attribute_allowed(name, &attribute.name)
            || reserved_navigation_attribute(attribute.name.as_bytes())
        {
            true
        } else {
            removed.push(attribute.name.clone());
            false
        }
    });
    removed
}

/// Filter the wrapper attributes of every element of a delivered tree, before any composition
/// step reads it.
pub(crate) fn filter_tree(nodes: &mut [Node]) -> Vec<(String, String)> {
    let mut removed = Vec::new();
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            let name = element.name.clone();
            removed.extend(
                filter_attributes_with_removed(element)
                    .into_iter()
                    .map(|attribute| (attribute, name.clone())),
            );
        }
        if let Some(children) = node.children_mut() {
            pending.extend(children.iter_mut().rev());
        }
    }
    removed
}

pub(crate) fn id(value: &str) -> Result<()> {
    if value.is_empty()
        || value.split('-').any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
    {
        return Err(invalid(
            Code::HtmlElement,
            format!("invalid ignore id {value:?}; use lowercase kebab-case"),
        ));
    }
    Ok(())
}
