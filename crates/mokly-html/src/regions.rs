//! Allocate inspection ids from final tree order, independent of render scheduling.

use std::collections::BTreeSet;

use mokly_model::usage::{ComponentRangeRecord, ComponentRangeTarget};

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{Node, RegionKind};

pub(crate) fn validate(nodes: &[Node]) -> Result<()> {
    ignores(nodes, false, &mut BTreeSet::new())
}

fn ignores(nodes: &[Node], active: bool, ids: &mut BTreeSet<String>) -> Result<()> {
    let mut pending: Vec<_> = nodes.iter().rev().map(|node| (node, active)).collect();
    while let Some((node, active)) = pending.pop() {
        match node {
            Node::Region { region, children } => {
                let ignored = matches!(region.kind, RegionKind::Ignore { .. });
                if let RegionKind::Ignore { id, .. } = &region.kind
                    && !ids.insert(id.clone())
                {
                    return Err(invalid(
                        Code::HtmlElement,
                        format!("duplicate ignore id {id}"),
                    ));
                }
                if active
                    && matches!(
                        region.kind,
                        RegionKind::Instance { .. } | RegionKind::Slot { .. }
                    )
                {
                    return Err(invalid(
                        Code::HtmlElement,
                        "an ignore region cannot enclose an instance or slot boundary",
                    ));
                }
                pending.extend(children.iter().rev().map(|node| (node, active || ignored)));
            }
            Node::Element(element) => {
                pending.extend(element.children.iter().rev().map(|node| (node, active)))
            }
            _ => {}
        }
    }
    Ok(())
}

pub(crate) fn number(nodes: &mut [Node]) -> Vec<ComponentRangeRecord> {
    let mut ranges = Vec::new();
    walk(nodes, None, &mut ranges);
    ranges
}

fn walk(nodes: &mut [Node], parent: Option<&str>, ranges: &mut Vec<ComponentRangeRecord>) {
    let mut pending: Vec<_> = nodes
        .iter_mut()
        .rev()
        .map(|node| (node, parent.map(str::to_owned)))
        .collect();
    while let Some((node, parent)) = pending.pop() {
        match node {
            Node::Element(element) => pending.extend(
                element
                    .children
                    .iter_mut()
                    .rev()
                    .map(|node| (node, parent.clone())),
            ),
            Node::Region { region, children } => {
                let target = match &region.kind {
                    RegionKind::Instance { key, .. } => Some(ComponentRangeTarget::Instance {
                        instance_key: key.clone(),
                    }),
                    RegionKind::Slot { key, .. } => Some(ComponentRangeTarget::Slot {
                        slot_key: key.clone(),
                    }),
                    RegionKind::Root { .. } => Some(ComponentRangeTarget::Root),
                    RegionKind::Ignore { .. } => None,
                };
                if let Some(target) = target {
                    region.id = format!("r-{}", ranges.len());
                    ranges.push(ComponentRangeRecord {
                        id: region.id.clone(),
                        target,
                        parent_id: parent,
                    });
                    pending.extend(
                        children
                            .iter_mut()
                            .rev()
                            .map(|node| (node, Some(region.id.clone()))),
                    );
                } else {
                    pending.extend(children.iter_mut().rev().map(|node| (node, parent.clone())));
                }
            }
            _ => {}
        }
    }
}
