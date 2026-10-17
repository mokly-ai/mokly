//! Rebuild logical identities when HTML repair removes an enclosing ownership range.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord};

use crate::error::Result;
use crate::normalized_keys::Keys;
use crate::tree::{Node, RegionKind};
use crate::tree_transform;

pub(crate) fn rebuild(
    nodes: &mut Vec<Node>,
    instances: &mut BTreeMap<String, ComponentInstanceRecord>,
    slots: &mut BTreeMap<String, ComponentSlotRecord>,
) -> Result<()> {
    let mut surviving = BTreeSet::new();
    let mut pending: Vec<_> = nodes.iter().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Instance { key, .. } = &region.kind {
                    surviving.insert(key.clone());
                }
                pending.extend(children);
            }
            Node::Element(element) => pending.extend(&element.children),
            _ => {}
        }
    }
    let original = mem::take(instances);
    let original_slots = mem::take(slots);
    let mut keys = Keys::new(&original, &original_slots, surviving);
    for (old, record) in &original {
        if let Some(key) = keys.instance(old)? {
            let mut record = record.clone();
            record.key = key.clone();
            record.owner = keys.owner(&record.owner)?;
            record.slot_key = match &record.slot_key {
                Some(slot) => keys.slot(slot)?,
                None => None,
            };
            instances.insert(key, record);
        }
    }
    for (old, record) in &original_slots {
        if let Some(key) = keys.slot(old)? {
            let mut record = record.clone();
            record.key = key.clone();
            record.instance_key = keys.instance(&record.instance_key)?.unwrap_or_default();
            record.owner = keys.owner(&record.owner)?;
            record.source_slot_key = match &record.source_slot_key {
                Some(slot) => keys.slot(slot)?,
                None => None,
            };
            slots.insert(key, record);
        }
    }
    *nodes = repair(mem::take(nodes), &mut keys)?;
    orders(nodes, instances);
    Ok(())
}

fn orders(nodes: &[Node], instances: &mut BTreeMap<String, ComponentInstanceRecord>) {
    let mut counts = BTreeMap::new();
    let mut seen = BTreeSet::new();
    let mut pending: Vec<_> = nodes.iter().rev().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Instance { key, .. } = &region.kind
                    && seen.insert(key.clone())
                    && let Some(instance) = instances.get_mut(key)
                {
                    let parent = match &instance.owner {
                        ComponentInputOwner::Entry => None,
                        ComponentInputOwner::Instance { instance_key } => {
                            Some(instance_key.clone())
                        }
                    };
                    let order = counts
                        .entry((parent, instance.slot_key.clone()))
                        .or_insert(0);
                    instance.order = *order;
                    *order += 1;
                }
                pending.extend(children.iter().rev());
            }
            Node::Element(element) => pending.extend(element.children.iter().rev()),
            _ => {}
        }
    }
}

fn repair(nodes: Vec<Node>, keys: &mut Keys<'_>) -> Result<Vec<Node>> {
    tree_transform::postorder(nodes, &mut |mut node| {
        if let Node::Region { region, children } = &mut node {
            match &mut region.kind {
                RegionKind::Instance { key, .. } => {
                    let Some(new) = keys.instance(key)? else {
                        return Ok(mem::take(children));
                    };
                    *key = new;
                }
                RegionKind::Slot {
                    key,
                    instance_key,
                    owner,
                    ..
                } => {
                    let Some(new) = keys.slot(key)? else {
                        return Ok(mem::take(children));
                    };
                    *key = new;
                    *instance_key = keys.instance(instance_key)?.unwrap_or_default();
                    *owner = keys.owner(owner)?;
                }
                _ => {}
            }
        }
        Ok(vec![node])
    })
}
