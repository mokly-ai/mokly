//! Flat private records preserve every trusted annotation without recursive codecs.

use mokly_html::links::Reference;
use mokly_html::tree::{Attribute, Element, Node, Region};
use mokly_model::catalogue::SourceLocation;
use serde::{Deserialize, Serialize};

use crate::capture_error::{CaptureInternalError, Result};

#[derive(Deserialize, Serialize)]
pub(crate) enum FlatNode {
    Element {
        style_owners: Option<Vec<String>>,
        origin: Option<String>,
        navigation: Option<Reference>,
        source: Option<SourceLocation>,
        name: String,
        namespace: String,
        attributes: Vec<Attribute>,
        children: usize,
    },
    Region {
        region: Region,
        children: usize,
    },
    Text(String),
    Comment(String),
    Doctype(String),
}

pub(crate) fn flatten(nodes: &[Node]) -> Vec<FlatNode> {
    let mut output = Vec::new();
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    while let Some(node) = pending.pop() {
        let record = match node {
            Node::Element(element) => {
                pending.extend(element.children.iter().rev());
                FlatNode::Element {
                    style_owners: element.style_owners.clone(),
                    origin: element.origin.clone(),
                    navigation: element.navigation.clone(),
                    source: element.source.clone(),
                    name: element.name.clone(),
                    namespace: element.namespace.clone(),
                    attributes: element.attributes.clone(),
                    children: element.children.len(),
                }
            }
            Node::Region { region, children } => {
                pending.extend(children.iter().rev());
                FlatNode::Region {
                    region: region.clone(),
                    children: children.len(),
                }
            }
            Node::Text(text) => FlatNode::Text(text.clone()),
            Node::Comment(text) => FlatNode::Comment(text.clone()),
            Node::Doctype(text) => FlatNode::Doctype(text.clone()),
        };
        output.push(record);
    }
    output
}

pub(crate) fn restore(nodes: Vec<FlatNode>) -> Result<Vec<Node>> {
    let mut output = Vec::new();
    for node in nodes.into_iter().rev() {
        let count = match &node {
            FlatNode::Element { children, .. } | FlatNode::Region { children, .. } => *children,
            _ => 0,
        };
        let Some(start) = output.len().checked_sub(count) else {
            return Err(CaptureInternalError::Tree.into());
        };
        let mut children = output.split_off(start);
        children.reverse();
        output.push(match node {
            FlatNode::Element {
                style_owners,
                origin,
                navigation,
                source,
                name,
                namespace,
                attributes,
                ..
            } => Node::Element(Element {
                style_owners,
                origin,
                navigation,
                source,
                name,
                namespace,
                attributes,
                children,
            }),
            FlatNode::Region { region, .. } => Node::Region { region, children },
            FlatNode::Text(text) => Node::Text(text),
            FlatNode::Comment(text) => Node::Comment(text),
            FlatNode::Doctype(text) => Node::Doctype(text),
        });
    }
    output.reverse();
    Ok(output)
}
