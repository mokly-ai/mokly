//! Preserve node metadata through browser repair without recursive tree conversion.

use std::mem;
use std::vec::IntoIter;

use crate::normalization::{ATTRIBUTE, Metadata, PREFIX, Placement, Repair};
use crate::tree::Node;

enum Finish {
    Root,
    Element(Box<Node>),
    Region(String),
}

struct Frame {
    parent: String,
    parent_name: String,
    owner: Option<String>,
    remaining: IntoIter<Node>,
    output: Vec<Node>,
    finish: Finish,
}

pub(crate) fn annotate(nodes: Vec<Node>, repair: &mut Repair) -> Vec<Node> {
    let mut frames = vec![Frame {
        parent: "document".into(),
        parent_name: "document".into(),
        owner: None,
        remaining: nodes.into_iter(),
        output: Vec::new(),
        finish: Finish::Root,
    }];
    let mut plaintext = false;
    while let Some(frame) = frames.last_mut() {
        if let Some(mut node) = frame.remaining.next() {
            match &mut node {
                Node::Region { region, children } => {
                    let id = repair.regions.len().to_string();
                    repair.regions.insert(
                        id.clone(),
                        Placement {
                            region: region.clone(),
                            parent: frame.parent.clone(),
                            parent_name: frame.parent_name.clone(),
                            enclosing: frame.owner.clone(),
                        },
                    );
                    frame
                        .output
                        .push(Node::Comment(format!("{PREFIX}{id}:start")));
                    let nested = Frame {
                        parent: frame.parent.clone(),
                        parent_name: frame.parent_name.clone(),
                        owner: Some(id.clone()),
                        remaining: mem::take(children).into_iter(),
                        output: Vec::new(),
                        finish: Finish::Region(id),
                    };
                    frames.push(nested);
                }
                Node::Element(element) => {
                    let id = if plaintext {
                        frame.parent.clone()
                    } else {
                        let id = repair.elements.len().to_string();
                        let previous = element.take(ATTRIBUTE);
                        repair.elements.insert(
                            id.clone(),
                            Metadata {
                                origin: element.origin.take(),
                                navigation: element.navigation.take(),
                                source: element.source.take(),
                                previous,
                                parent: frame.parent.clone(),
                                owner: frame.owner.clone(),
                            },
                        );
                        element.set(ATTRIBUTE, &id);
                        id
                    };
                    plaintext |= element.is_html() && element.name == "plaintext";
                    let nested = Frame {
                        parent: id,
                        parent_name: element.name.clone(),
                        owner: frame.owner.clone(),
                        remaining: mem::take(&mut element.children).into_iter(),
                        output: Vec::new(),
                        finish: Finish::Element(Box::new(node)),
                    };
                    frames.push(nested);
                }
                _ => frame.output.push(node),
            }
            continue;
        }
        if let Some(frame) = frames.pop() {
            let result = match frame.finish {
                Finish::Root => return frame.output,
                Finish::Element(mut node) => {
                    if let Some(children) = node.children_mut() {
                        *children = frame.output;
                    }
                    vec![*node]
                }
                Finish::Region(id) => {
                    let mut children = frame.output;
                    children.push(Node::Comment(format!("{PREFIX}{id}:end")));
                    children
                }
            };
            if let Some(parent) = frames.last_mut() {
                parent.output.extend(result);
            }
        }
    }
    Vec::new()
}
