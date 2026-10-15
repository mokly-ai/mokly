//! Complete acyclic input graphs and physical region ordering.

use std::collections::{BTreeMap, BTreeSet};

use crate::axes::EntryKind;
use crate::detail_context::invalid;
use crate::public_records::CatalogueComponent;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::usage::{
    ComponentInputOwner, ComponentInstanceRecord, ComponentRangeRecord, ComponentRangeTarget,
    ComponentSlotRecord,
};

pub(crate) fn validate(
    instances: &[ComponentInstanceRecord],
    slots: &[ComponentSlotRecord],
    ranges: &[ComponentRangeRecord],
    kind: EntryKind,
    components: &[CatalogueComponent],
) -> Result<(), ReadError> {
    let instances: BTreeMap<_, _> = instances
        .iter()
        .map(|instance| (instance.key.as_str(), instance))
        .collect();
    let slots: BTreeMap<_, _> = slots.iter().map(|slot| (slot.key.as_str(), slot)).collect();
    let owner_key = |owner: &ComponentInputOwner| match owner {
        ComponentInputOwner::Entry => None,
        ComponentInputOwner::Instance { instance_key } => Some(instance_key.clone()),
    };
    let mut graph: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for instance in instances.values() {
        let mut edges = Vec::new();
        if let Some(owner) = owner_key(&instance.owner) {
            if !instances.contains_key(owner.as_str()) {
                return Err(invalid(ContractViolation::UsageReference));
            }
            edges.push(format!("i:{owner}"));
        }
        if let Some(slot) = &instance.slot_key {
            let slot = slots
                .get(slot.as_str())
                .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
            if owner_key(&slot.owner) != owner_key(&instance.owner) {
                return Err(invalid(ContractViolation::UsageReference));
            }
            edges.push(format!("s:{}", slot.key));
        }
        graph.insert(format!("i:{}", instance.key), edges);
    }
    for slot in slots.values() {
        let receiver = instances
            .get(slot.instance_key.as_str())
            .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
        let component = components
            .iter()
            .find(|component| component.entry.path == receiver.component_id)
            .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
        if !component.slots.contains(&slot.name) {
            return Err(invalid(ContractViolation::UsageReference));
        }
        let mut edges = vec![format!("i:{}", receiver.key)];
        if let Some(owner) = owner_key(&slot.owner) {
            if !instances.contains_key(owner.as_str()) {
                return Err(invalid(ContractViolation::UsageReference));
            }
            edges.push(format!("i:{owner}"));
        }
        if let Some(source) = &slot.source_slot_key {
            let source = slots
                .get(source.as_str())
                .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
            if owner_key(&source.owner) != owner_key(&slot.owner) {
                return Err(invalid(ContractViolation::UsageReference));
            }
            edges.push(format!("s:{}", source.key));
        }
        graph.insert(format!("s:{}", slot.key), edges);
    }
    let mut done = BTreeSet::new();
    for key in graph.keys() {
        if !acyclic(key, &graph, &mut BTreeSet::new(), &mut done) {
            return Err(invalid(ContractViolation::UsageCycle));
        }
    }
    let mut stack: Vec<&str> = Vec::new();
    let mut placed = BTreeSet::new();
    let mut roots = 0;
    for (position, range) in ranges.iter().enumerate() {
        if range.id != format!("r-{position}") {
            return Err(invalid(ContractViolation::UsageRange));
        }
        if let Some(parent) = range.parent_id.as_deref() {
            while stack.last().is_some_and(|last| *last != parent) {
                stack.pop();
            }
            if stack.is_empty() {
                return Err(invalid(ContractViolation::UsageRange));
            }
        } else {
            stack.clear();
        }
        match &range.target {
            ComponentRangeTarget::Instance { instance_key } => {
                if !instances.contains_key(instance_key.as_str()) {
                    return Err(invalid(ContractViolation::UsageReference));
                }
                placed.insert(instance_key.as_str());
            }
            ComponentRangeTarget::Slot { slot_key } => {
                if !slots.contains_key(slot_key.as_str()) {
                    return Err(invalid(ContractViolation::UsageReference));
                }
            }
            ComponentRangeTarget::Root => {
                roots += 1;
                if position != 0 || range.parent_id.is_some() {
                    return Err(invalid(ContractViolation::UsageRange));
                }
            }
        }
        if kind == EntryKind::Component && position > 0 && stack.first().copied() != Some("r-0") {
            return Err(invalid(ContractViolation::UsageRange));
        }
        stack.push(&range.id);
    }
    if roots != usize::from(kind == EntryKind::Component) || placed.len() != instances.len() {
        return Err(invalid(ContractViolation::UsageRange));
    }
    Ok(())
}

fn acyclic(
    key: &str,
    graph: &BTreeMap<String, Vec<String>>,
    active: &mut BTreeSet<String>,
    done: &mut BTreeSet<String>,
) -> bool {
    if done.contains(key) {
        return true;
    }
    if !active.insert(key.into()) {
        return false;
    }
    for next in &graph[key] {
        if !acyclic(next, graph, active, done) {
            return false;
        }
    }
    active.remove(key);
    done.insert(key.into());
    true
}
