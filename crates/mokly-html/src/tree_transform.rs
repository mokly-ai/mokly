//! Bottom-up owned-tree rewrites with explicit sibling frames.

use std::vec::IntoIter;

use crate::error::Result;
use crate::tree::Node;

struct Frame {
    parent: Option<Node>,
    remaining: IntoIter<Node>,
    output: Vec<Node>,
}

/// Rewrite each node after its descendants, retaining sibling order.
pub(crate) fn postorder(
    nodes: Vec<Node>,
    rewrite: &mut dyn FnMut(Node) -> Result<Vec<Node>>,
) -> Result<Vec<Node>> {
    let mut frames = vec![Frame {
        parent: None,
        remaining: nodes.into_iter(),
        output: Vec::new(),
    }];
    while let Some(frame) = frames.last_mut() {
        if let Some(mut node) = frame.remaining.next() {
            let children = node.take_children();
            if children.is_empty() {
                frame.output.extend(rewrite(node)?);
            } else {
                frames.push(Frame {
                    parent: Some(node),
                    remaining: children.into_iter(),
                    output: Vec::new(),
                });
            }
            continue;
        }
        if let Some(frame) = frames.pop() {
            let Some(mut node) = frame.parent else {
                return Ok(frame.output);
            };
            if let Some(children) = node.children_mut() {
                *children = frame.output;
            }
            let result = rewrite(node)?;
            if let Some(parent) = frames.last_mut() {
                parent.output.extend(result);
            }
        }
    }
    Ok(Vec::new())
}
