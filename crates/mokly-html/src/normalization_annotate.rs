//! Preserve node metadata through browser repair without recursive tree conversion.

use std::mem;
use std::vec::IntoIter;

use crate::normalization::{ATTRIBUTE, Metadata, PREFIX, Placement, Repair};
use crate::text_mode::{TextMode, Token};
use crate::tree::Node;

enum Finish {
    Root,
    Element(Box<Node>, Token),
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
    annotate_with_plaintext(nodes, repair, true)
}

/// Annotate a fresh tree while optionally disabling plaintext prediction.
pub(crate) fn annotate_with_plaintext(
    nodes: Vec<Node>,
    repair: &mut Repair,
    allow_plaintext: bool,
) -> Vec<Node> {
    let mut frames = vec![Frame {
        parent: "document".into(),
        parent_name: "document".into(),
        owner: None,
        remaining: nodes.into_iter(),
        output: Vec::new(),
        finish: Finish::Root,
    }];
    let mut mode = if allow_plaintext {
        TextMode::default()
    } else {
        TextMode::without_plaintext()
    };
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
                    let id = if mode.plaintext() {
                        frame.parent.clone()
                    } else {
                        let id = repair.elements.len().to_string();
                        let previous = element.take(ATTRIBUTE);
                        repair.elements.insert(
                            id.clone(),
                            Metadata {
                                style_owners: element.style_owners.take(),
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
                    let token = mode.enter(element);
                    let nested = Frame {
                        parent: id,
                        parent_name: element.name.clone(),
                        owner: frame.owner.clone(),
                        remaining: mem::take(&mut element.children).into_iter(),
                        output: Vec::new(),
                        finish: Finish::Element(Box::new(node), token),
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
                Finish::Element(mut node, token) => {
                    if let Node::Element(element) = node.as_ref() {
                        mode.leave(token, &element.name);
                    }
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
