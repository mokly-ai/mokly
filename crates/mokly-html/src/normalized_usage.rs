//! Rebuild logical identities when HTML repair removes an enclosing ownership range.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_model::material::{instance_key, slot_key};
use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord};

use crate::diagnostic_code::Code;
use crate::error::{HtmlError, Result, invalid};
use crate::tree::{Node, RegionKind};

struct Keys<'a> {
    instances: &'a BTreeMap<String, ComponentInstanceRecord>,
    slots: &'a BTreeMap<String, ComponentSlotRecord>,
    surviving: BTreeSet<String>,
    claimed: BTreeSet<String>,
    mapped: BTreeMap<String, String>,
    mapped_slots: BTreeMap<String, String>,
    visiting: BTreeSet<String>,
}

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
    let mut keys = Keys {
        instances: &original,
        slots: &original_slots,
        surviving,
        claimed: BTreeSet::new(),
        mapped: BTreeMap::new(),
        mapped_slots: BTreeMap::new(),
        visiting: BTreeSet::new(),
    };
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

impl Keys<'_> {
    fn owner(&mut self, original: &ComponentInputOwner) -> Result<ComponentInputOwner> {
        let mut owner = original.clone();
        let mut seen = BTreeSet::new();
        while let ComponentInputOwner::Instance { instance_key } = &owner {
            if let Some(key) = self.instance(instance_key)? {
                return Ok(ComponentInputOwner::Instance { instance_key: key });
            }
            if !seen.insert(instance_key.clone()) {
                return Err(invalid(
                    Code::BuildInvalid,
                    "cyclic instance owner after HTML repair",
                ));
            }
            owner = self
                .instances
                .get(instance_key)
                .map_or(ComponentInputOwner::Entry, |record| record.owner.clone());
        }
        Ok(owner)
    }

    fn instance(&mut self, old: &str) -> Result<Option<String>> {
        if !self.surviving.contains(old) {
            return Ok(None);
        }
        if let Some(key) = self.mapped.get(old) {
            return Ok(Some(key.clone()));
        }
        if !self.visiting.insert(old.into()) {
            return Err(invalid(
                Code::BuildInvalid,
                "cyclic instance identity after HTML repair",
            ));
        }
        let Some(record) = self.instances.get(old) else {
            return Ok(None);
        };
        let owner = self.owner(&record.owner)?;
        let slot = match &record.slot_key {
            Some(slot) => self.slot(slot)?,
            None => None,
        };
        let key = match instance_key(&owner, slot.as_deref(), &record.id) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        self.visiting.remove(old);
        if key != old && (self.surviving.contains(&key) || self.claimed.contains(&key)) {
            self.surviving.remove(old);
            return Ok(None);
        }
        self.claimed.insert(key.clone());
        self.mapped.insert(old.into(), key.clone());
        Ok(Some(key))
    }

    fn slot(&mut self, old: &str) -> Result<Option<String>> {
        if let Some(key) = self.mapped_slots.get(old) {
            return Ok(Some(key.clone()));
        }
        let Some(slot) = self.slots.get(old) else {
            return Ok(None);
        };
        let Some(instance) = self.instance(&slot.instance_key)? else {
            return Ok(None);
        };
        let key = match slot_key(&instance, &slot.name) {
            Ok(key) => key,
            Err(source) => return Err(HtmlError::Props { source }),
        };
        self.mapped_slots.insert(old.into(), key.clone());
        Ok(Some(key))
    }
}

fn repair(nodes: Vec<Node>, keys: &mut Keys<'_>) -> Result<Vec<Node>> {
    let mut output = Vec::new();
    for mut node in nodes {
        match &mut node {
            Node::Element(element) => {
                element.children = repair(mem::take(&mut element.children), keys)?
            }
            Node::Region { region, children } => {
                *children = repair(mem::take(children), keys)?;
                match &mut region.kind {
                    RegionKind::Instance { key, .. } => {
                        let Some(new) = keys.instance(key)? else {
                            output.append(children);
                            continue;
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
                            output.append(children);
                            continue;
                        };
                        *key = new;
                        *instance_key = keys.instance(instance_key)?.unwrap_or_default();
                        *owner = keys.owner(owner)?;
                    }
                    _ => {}
                }
            }
            _ => {}
        }
        output.push(node);
    }
    Ok(output)
}
