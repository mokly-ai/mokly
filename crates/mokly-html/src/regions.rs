//! Allocate inspection ids from final tree order, independent of render scheduling.

use std::collections::BTreeSet;

use mokly_model::usage::{ComponentRangeRecord, ComponentRangeTarget};

use crate::error::{Result, invalid};
use crate::tree::{Node, RegionKind};

pub(crate) fn validate(nodes: &[Node]) -> Result<()> {
    ignores(nodes, false, &mut BTreeSet::new())
}

fn ignores(nodes: &[Node], active: bool, ids: &mut BTreeSet<String>) -> Result<()> {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                let ignored = matches!(region.kind, RegionKind::Ignore { .. });
                if let RegionKind::Ignore { id, .. } = &region.kind
                    && !ids.insert(id.clone())
                {
                    return Err(invalid("html-element", format!("duplicate ignore id {id}")));
                }
                if active
                    && matches!(
                        region.kind,
                        RegionKind::Instance { .. } | RegionKind::Slot { .. }
                    )
                {
                    return Err(invalid(
                        "html-element",
                        "an ignore region cannot enclose an instance or slot boundary",
                    ));
                }
                ignores(children, active || ignored, ids)?;
            }
            Node::Element(element) => ignores(&element.children, active, ids)?,
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
    for node in nodes {
        match node {
            Node::Element(element) => walk(&mut element.children, parent, ranges),
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
                        parent_id: parent.map(str::to_owned),
                    });
                    walk(children, Some(&region.id), ranges);
                } else {
                    walk(children, parent, ranges);
                }
            }
            _ => {}
        }
    }
}
