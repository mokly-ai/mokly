//! Fragment comment markers become sibling-region annotations before grafting.

use std::collections::BTreeSet;
use std::mem;
use std::vec::IntoIter;

use mokly_catalogue::preparation::PreparedCatalogue;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::fragment::Fragment;
use crate::marker_syntax::{Marker, parse};
use crate::tree::Node;
use crate::{fragment_validation, marker_auth, marker_regions};

pub(crate) fn attach(
    nodes: Vec<Node>,
    fragment: &Fragment,
    catalogue: &PreparedCatalogue,
    ignore_ids: &mut BTreeSet<String>,
    output_root: Option<&str>,
) -> Result<Vec<Node>> {
    fragment_validation::records(fragment, catalogue)?;
    let mut ids = BTreeSet::new();
    let nodes = siblings(nodes, fragment, &mut ids, ignore_ids, output_root)?;
    fragment_validation::placements(&nodes, fragment)?;
    if ids.len() != fragment.markers.len() {
        return Err(invalid(
            Code::BuildInvalid,
            "an authenticated fragment marker was not consumed",
        ));
    }
    Ok(nodes)
}

struct Frame {
    parent: Option<Node>,
    inherited: Option<String>,
    remaining: IntoIter<Node>,
    regions: Vec<(Marker, Vec<Node>)>,
    output: Vec<Node>,
}

fn siblings(
    nodes: Vec<Node>,
    fragment: &Fragment,
    ids: &mut BTreeSet<String>,
    ignore_ids: &mut BTreeSet<String>,
    output_root: Option<&str>,
) -> Result<Vec<Node>> {
    let mut frames = vec![Frame {
        parent: None,
        inherited: None,
        remaining: nodes.into_iter(),
        regions: Vec::new(),
        output: Vec::new(),
    }];
    while let Some(frame) = frames.last_mut() {
        if let Some(mut node) = frame.remaining.next() {
            if let Node::Comment(comment) = &node
                && let Some(marker) = parse(comment)?
            {
                if marker.start {
                    marker_auth::start(
                        &marker,
                        fragment,
                        frame
                            .regions
                            .last()
                            .map(|(marker, _)| marker.id.as_str())
                            .or(frame.inherited.as_deref()),
                    )?;
                    if !ids.insert(marker.id.clone()) {
                        return Err(invalid(Code::BuildInvalid, "duplicate fragment marker id"));
                    }
                    frame.regions.push((marker, Vec::new()));
                } else {
                    let Some((start, children)) = frame.regions.pop() else {
                        return Err(invalid(Code::BuildInvalid, "unmatched fragment marker"));
                    };
                    if start.id != marker.id || start.kind != marker.kind {
                        return Err(invalid(
                            Code::BuildInvalid,
                            "crossing or reordered fragment markers",
                        ));
                    }
                    let nodes =
                        marker_regions::close(start, children, fragment, ignore_ids, output_root)?;
                    append(frame, nodes);
                }
                continue;
            }
            if let Node::Element(element) = &mut node {
                let inherited = frame
                    .regions
                    .last()
                    .map(|(marker, _)| marker.id.clone())
                    .or_else(|| frame.inherited.clone());
                let nested = Frame {
                    inherited,
                    remaining: mem::take(&mut element.children).into_iter(),
                    parent: Some(node),
                    regions: Vec::new(),
                    output: Vec::new(),
                };
                frames.push(nested);
            } else {
                append(frame, vec![node]);
            }
            continue;
        }
        if let Some(frame) = frames.pop() {
            if !frame.regions.is_empty() {
                return Err(invalid(
                    Code::BuildInvalid,
                    "fragment marker does not close under one parent",
                ));
            }
            let Some(mut node) = frame.parent else {
                return Ok(frame.output);
            };
            if let Some(children) = node.children_mut() {
                *children = frame.output;
            }
            if let Some(parent) = frames.last_mut() {
                append(parent, vec![node]);
            }
        }
    }
    Ok(Vec::new())
}

fn append(frame: &mut Frame, nodes: Vec<Node>) {
    if let Some((_, children)) = frame.regions.last_mut() {
        children.extend(nodes);
    } else {
        frame.output.extend(nodes);
    }
}
