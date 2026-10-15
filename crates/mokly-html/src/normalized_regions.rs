//! Restore authenticated internal placements after the HTML5 adoption algorithms.

use std::collections::BTreeMap;
use std::mem;

use crate::normalization::{self, ATTRIBUTE, Repair};
use crate::tree::Node;

pub(crate) fn classify(nodes: &[Node], repair: &mut Repair) {
    let mut edges: BTreeMap<String, Vec<(bool, usize, usize, String)>> = BTreeMap::new();
    let mut pending = vec![(nodes, "document".to_owned(), 0)];
    let mut next = 1;
    while let Some((nodes, parent_id, parent)) = pending.pop() {
        for (offset, node) in nodes.iter().enumerate() {
            if let Some((id, start)) = normalization::marker(node) {
                edges.entry(id.into()).or_default().push((
                    start,
                    parent,
                    offset,
                    parent_id.clone(),
                ));
            }
            if let Node::Element(element) = node {
                let id = element.get(ATTRIBUTE).unwrap_or("implied");
                if let Some(metadata) = repair.elements.get(id)
                    && metadata.parent != parent_id
                    && let Some(owner) = &metadata.owner
                {
                    repair.moved.insert(owner.clone());
                }
                pending.push((&element.children, id.into(), next));
                next += 1;
            }
        }
    }
    for (id, placement) in &repair.regions {
        let pair = edges.get(id).map(Vec::as_slice);
        if let Some([(true, first, start, parent), (false, last, end, _)]) = pair
            && first == last
            && start < end
        {
            repair.valid.insert(id.clone());
            if &placement.parent != parent {
                repair.moved.insert(id.clone());
            }
        } else {
            repair.moved.insert(id.clone());
        }
    }
}

pub(crate) fn restore(nodes: Vec<Node>, repair: &mut Repair) -> Vec<Node> {
    let mut output = Vec::new();
    let mut stack: Vec<(String, Vec<Node>)> = Vec::new();
    for mut node in nodes {
        if let Some((id, start)) = normalization::marker(&node) {
            let id = id.to_owned();
            if repair.valid.contains(&id) {
                if start {
                    stack.push((id, Vec::new()));
                } else if let Some((open, children)) = stack.pop() {
                    if open == id {
                        if let Some(placement) = repair.regions.get(&id) {
                            push(
                                &mut output,
                                &mut stack,
                                Node::Region {
                                    region: placement.region.clone(),
                                    children,
                                },
                            );
                        }
                    } else {
                        repair.moved.extend([open, id]);
                        for child in children {
                            push(&mut output, &mut stack, child);
                        }
                    }
                }
            }
            continue;
        }
        if let Node::Element(element) = &mut node {
            normalization::metadata(element, repair);
            element.children = restore(mem::take(&mut element.children), repair);
        }
        push(&mut output, &mut stack, node);
    }
    for (_, children) in stack {
        output.extend(children);
    }
    output
}

fn push(output: &mut Vec<Node>, stack: &mut [(String, Vec<Node>)], node: Node) {
    match stack.last_mut() {
        Some((_, nodes)) => nodes.push(node),
        None => output.push(node),
    }
}
