//! Cached fragments use entry-local identities; grafting binds their outer input scope.

use std::collections::BTreeMap;

use mokly_model::material::{instance_key, slot_key};
use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord};

use crate::context::Context;
use crate::diagnostic_code::Code;
use crate::error::{HtmlError, Result, invalid};
use crate::tree::{Node, RegionKind};

pub(crate) fn rebase(
    nodes: &mut [Node],
    instances: &mut [ComponentInstanceRecord],
    slots: &mut [ComponentSlotRecord],
    context: &Context,
) -> Result<()> {
    let mut instance_keys = BTreeMap::new();
    let mut slot_keys: BTreeMap<String, String> = BTreeMap::new();
    for _ in 0..=instances.len() + slots.len() {
        let previous = instance_keys.len() + slot_keys.len();
        for instance in instances.iter() {
            if instance_keys.contains_key(&instance.key) {
                continue;
            }
            let Some(owner) = owner(&instance.owner, &instance_keys, context) else {
                continue;
            };
            let slot = match &instance.slot_key {
                Some(key) => match slot_keys.get(key) {
                    Some(key) => Some(key.as_str()),
                    None => continue,
                },
                None => None,
            };
            let key = match instance_key(&owner, slot, &instance.id) {
                Ok(key) => key,
                Err(source) => return Err(HtmlError::Props { source }),
            };
            instance_keys.insert(instance.key.clone(), key);
        }
        for slot in slots.iter() {
            if let Some(instance) = instance_keys.get(&slot.instance_key) {
                let key = match slot_key(instance, &slot.name) {
                    Ok(key) => key,
                    Err(source) => return Err(HtmlError::Props { source }),
                };
                slot_keys.insert(slot.key.clone(), key);
            }
        }
        if previous == instance_keys.len() + slot_keys.len() {
            break;
        }
    }
    if instance_keys.len() != instances.len() || slot_keys.len() != slots.len() {
        return Err(invalid(
            Code::BuildInvalid,
            "fragment input scope contains a cycle",
        ));
    }
    for instance in instances {
        instance.owner = owner(&instance.owner, &instance_keys, context)
            .ok_or_else(|| invalid(Code::BuildInvalid, "unknown fragment owner"))?;
        instance.slot_key = instance
            .slot_key
            .as_ref()
            .and_then(|key| slot_keys.get(key).cloned());
        instance.key = instance_keys[&instance.key].clone();
    }
    for slot in slots {
        slot.owner = owner(&slot.owner, &instance_keys, context)
            .ok_or_else(|| invalid(Code::BuildInvalid, "unknown fragment slot owner"))?;
        slot.instance_key = instance_keys[&slot.instance_key].clone();
        slot.key = slot_keys[&slot.key].clone();
        slot.source_slot_key = slot
            .source_slot_key
            .as_ref()
            .and_then(|key| slot_keys.get(key).cloned());
    }
    regions(nodes, &instance_keys, &slot_keys, context);
    Ok(())
}

fn owner(
    value: &ComponentInputOwner,
    keys: &BTreeMap<String, String>,
    context: &Context,
) -> Option<ComponentInputOwner> {
    Some(match value {
        ComponentInputOwner::Entry => context.owner.clone(),
        ComponentInputOwner::Instance { instance_key } => ComponentInputOwner::Instance {
            instance_key: keys.get(instance_key)?.clone(),
        },
    })
}

fn regions(
    nodes: &mut [Node],
    instances: &BTreeMap<String, String>,
    slots: &BTreeMap<String, String>,
    context: &Context,
) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                match &mut region.kind {
                    RegionKind::Instance { key, .. } => {
                        if let Some(rebased) = instances.get(key) {
                            *key = rebased.clone();
                        }
                    }
                    RegionKind::Slot {
                        key,
                        instance_key,
                        owner: input_owner,
                        ..
                    } => {
                        if let Some(rebased) = slots.get(key) {
                            *key = rebased.clone();
                        }
                        if let Some(rebased) = instances.get(instance_key) {
                            *instance_key = rebased.clone();
                        }
                        if let Some(rebased) = owner(input_owner, instances, context) {
                            *input_owner = rebased;
                        }
                    }
                    _ => {}
                }
                regions(children, instances, slots, context);
            }
            Node::Element(element) => regions(&mut element.children, instances, slots, context),
            _ => {}
        }
    }
}
