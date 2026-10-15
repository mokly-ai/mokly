//! Fragment comment markers become sibling-region annotations before grafting.

use std::collections::BTreeSet;
use std::mem;

use mokly_catalogue::preparation::PreparedCatalogue;

use crate::error::{Result, invalid};
use crate::fragment::Fragment;
use crate::marker_syntax::{Marker, parse, required};
use crate::tree::{Node, Region, RegionKind};
use crate::{control_roots, fragment_validation, marker_auth};

pub(crate) fn attach(
    nodes: Vec<Node>,
    fragment: &Fragment,
    catalogue: &PreparedCatalogue,
    ignore_ids: &mut BTreeSet<String>,
) -> Result<Vec<Node>> {
    fragment_validation::records(fragment, catalogue)?;
    let mut ids = BTreeSet::new();
    let nodes = siblings(nodes, fragment, &mut ids, ignore_ids, None)?;
    fragment_validation::placements(&nodes, fragment)?;
    if ids.len() != fragment.markers.len() {
        return Err(invalid(
            "build-invalid",
            "an authenticated fragment marker was not consumed",
        ));
    }
    Ok(nodes)
}

fn siblings(
    nodes: Vec<Node>,
    fragment: &Fragment,
    ids: &mut BTreeSet<String>,
    ignore_ids: &mut BTreeSet<String>,
    inherited: Option<&str>,
) -> Result<Vec<Node>> {
    let mut stack: Vec<(Marker, Vec<Node>)> = Vec::new();
    let mut output = Vec::new();
    for mut node in nodes {
        if let Node::Comment(comment) = &node
            && let Some(marker) = parse(comment)?
        {
            if marker.start {
                marker_auth::start(
                    &marker,
                    fragment,
                    stack
                        .last()
                        .map(|(marker, _)| marker.id.as_str())
                        .or(inherited),
                )?;
                if !ids.insert(marker.id.clone()) {
                    return Err(invalid("build-invalid", "duplicate fragment marker id"));
                }
                stack.push((marker, Vec::new()));
            } else {
                let Some((start, mut children)) = stack.pop() else {
                    return Err(invalid("build-invalid", "unmatched fragment marker"));
                };
                if start.id != marker.id || start.kind != marker.kind {
                    return Err(invalid(
                        "build-invalid",
                        "crossing or reordered fragment markers",
                    ));
                }
                let kind = match start.kind.as_str() {
                    "instance" => {
                        let key = required(&start, "instance")?;
                        let instance = fragment
                            .instances
                            .iter()
                            .find(|instance| instance.key == key)
                            .ok_or_else(|| {
                                invalid(
                                    "build-invalid",
                                    "instance marker has no authenticated input record",
                                )
                            })?;
                        if required(&start, "path")? != instance.component_id
                            || required(&start, "props")? != instance.props_key
                        {
                            return Err(invalid("build-invalid", "forged instance marker"));
                        }
                        Some(RegionKind::Instance {
                            path: instance.component_id.clone(),
                            key: key.into(),
                            local_id: instance.id.clone(),
                            props_key: instance.props_key.clone(),
                        })
                    }
                    "slot" => {
                        let slot = marker_auth::slot(&start, fragment)?;
                        Some(RegionKind::Slot {
                            key: slot.key.clone(),
                            instance_key: slot.instance_key.clone(),
                            name: slot.name.clone(),
                            owner: slot.owner.clone(),
                        })
                    }
                    "ignore" => {
                        if !ignore_ids.insert(start.id.clone()) {
                            return Err(invalid("build-invalid", "duplicate ignore id"));
                        }
                        Some(RegionKind::Ignore {
                            id: start.id.clone(),
                            material_key: start.attributes.get("key").cloned(),
                        })
                    }
                    "link" => {
                        let target = required(&start, "to")?;
                        let (target, fragment) = target
                            .split_once('#')
                            .map_or((target, None), |(target, fragment)| {
                                (target, Some(fragment))
                            });
                        control_roots::mark(&mut children, target, fragment)?;
                        None
                    }
                    _ => return Err(invalid("build-invalid", "unknown fragment marker")),
                };
                let nodes = if let Some(kind) = kind {
                    vec![Node::Region {
                        region: Region {
                            id: start.id.clone(),
                            kind,
                        },
                        children,
                    }]
                } else {
                    children
                };
                if let Some((_, parent)) = stack.last_mut() {
                    parent.extend(nodes);
                } else {
                    output.extend(nodes);
                }
            }
            continue;
        }
        if let Node::Element(element) = &mut node {
            let parent = stack
                .last()
                .map(|(marker, _)| marker.id.as_str())
                .or(inherited);
            element.children = siblings(
                mem::take(&mut element.children),
                fragment,
                ids,
                ignore_ids,
                parent,
            )?;
        }
        if let Some((_, children)) = stack.last_mut() {
            children.push(node);
        } else {
            output.push(node);
        }
    }
    if !stack.is_empty() {
        return Err(invalid(
            "build-invalid",
            "fragment marker does not close under one parent",
        ));
    }
    Ok(output)
}
