//! Authenticate fragment input records before interpreting their comment regions.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::EntryContent;
use mokly_model::diagnostic::AuthoringKind;
use mokly_model::material::{instance_key, props_key, slot_key};
use mokly_model::usage::ComponentInputOwner;
use mokly_model::wire_decode;

use crate::error::{Result, invalid};
use crate::fragment::Fragment;
use crate::props;
use crate::tree::{Node, RegionKind};

pub(crate) fn records(fragment: &Fragment, catalogue: &PreparedCatalogue) -> Result<()> {
    for style in &fragment.styles {
        for owner in &style.owners {
            if !catalogue.model.entries.iter().any(|entry| {
                &entry.metadata.path == owner
                    && entry.metadata.variant_of.is_none()
                    && matches!(entry.content, EntryContent::Component { .. })
            }) {
                return Err(invalid(
                    "build-invalid",
                    "collected style has an unknown component owner",
                ));
            }
        }
    }
    let mut marker_ids = BTreeSet::new();
    if fragment
        .markers
        .iter()
        .any(|marker| marker.id.is_empty() || !marker_ids.insert(&marker.id))
    {
        return Err(invalid(
            "build-invalid",
            "duplicate authenticated fragment marker id",
        ));
    }
    let mut keys = BTreeSet::new();
    let mut scopes: BTreeMap<String, BTreeSet<u64>> = BTreeMap::new();
    for instance in &fragment.instances {
        let props = wire_decode::decode(&instance.props).ok();
        let component = catalogue.model.entries.iter().find(|entry| {
            entry.metadata.path == instance.component_id && entry.metadata.variant_of.is_none()
        });
        let schema = component.and_then(|component| {
            if let EntryContent::Component { visual, .. } = &component.content {
                Some(&visual.prop_schema)
            } else {
                None
            }
        });
        if !keys.insert(instance.key.clone())
            || schema.is_none()
            || instance_key(&instance.owner, instance.slot_key.as_deref(), &instance.id)
                .ok()
                .as_ref()
                != Some(&instance.key)
            || props
                .as_ref()
                .and_then(|props| props_key(props).ok())
                .as_ref()
                != Some(&instance.props_key)
        {
            return Err(invalid(
                "build-invalid",
                "forged fragment instance metadata",
            ));
        }
        if let (Some(schema), Some(props)) = (schema, &props) {
            props::validate_for(
                schema,
                props,
                &instance.component_id,
                AuthoringKind::JavaScript,
            )?;
        }
        let scope = format!("{:?}/{:?}", instance.owner, instance.slot_key);
        if !scopes.entry(scope).or_default().insert(instance.order) {
            return Err(invalid("build-invalid", "duplicate fragment input order"));
        }
    }
    if scopes
        .values()
        .any(|orders| orders.iter().copied().ne(0..orders.len() as u64))
    {
        return Err(invalid(
            "build-invalid",
            "fragment input order is not contiguous",
        ));
    }
    let mut slots = BTreeSet::new();
    for slot in &fragment.slots {
        if !slots.insert(slot.key.clone())
            || !keys.contains(&slot.instance_key)
            || slot_key(&slot.instance_key, &slot.name).ok().as_ref() != Some(&slot.key)
        {
            return Err(invalid("build-invalid", "forged fragment slot metadata"));
        }
    }
    for instance in &fragment.instances {
        if matches!(&instance.owner, ComponentInputOwner::Instance { instance_key } if !keys.contains(instance_key))
            || instance
                .slot_key
                .as_ref()
                .is_some_and(|key| !slots.contains(key))
        {
            return Err(invalid(
                "build-invalid",
                "fragment input scope is incomplete",
            ));
        }
    }
    for slot in &fragment.slots {
        if matches!(&slot.owner, ComponentInputOwner::Instance { instance_key } if !keys.contains(instance_key))
            || slot
                .source_slot_key
                .as_ref()
                .is_some_and(|key| !slots.contains(key))
        {
            return Err(invalid(
                "build-invalid",
                "fragment slot scope is incomplete",
            ));
        }
    }
    acyclic(
        fragment
            .slots
            .iter()
            .map(|slot| (slot.key.as_str(), slot.source_slot_key.as_deref()))
            .collect(),
    )?;
    acyclic(
        fragment
            .instances
            .iter()
            .map(|instance| {
                (
                    instance.key.as_str(),
                    match &instance.owner {
                        ComponentInputOwner::Entry => None,
                        ComponentInputOwner::Instance { instance_key } => {
                            Some(instance_key.as_str())
                        }
                    },
                )
            })
            .collect(),
    )?;
    Ok(())
}

pub(crate) fn placements(nodes: &[Node], fragment: &Fragment) -> Result<()> {
    let mut seen = BTreeSet::new();
    collect(nodes, &mut seen, false)?;
    if fragment
        .instances
        .iter()
        .any(|instance| !seen.contains(&instance.key))
    {
        return Err(invalid(
            "build-invalid",
            "fragment instance has no ownership region",
        ));
    }
    Ok(())
}

fn collect(nodes: &[Node], seen: &mut BTreeSet<String>, ignored: bool) -> Result<()> {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if matches!(
                    region.kind,
                    RegionKind::Instance { .. } | RegionKind::Slot { .. }
                ) && ignored
                {
                    return Err(invalid(
                        "build-invalid",
                        "an ignore region cannot enclose an instance or slot boundary",
                    ));
                }
                if let RegionKind::Instance { key, .. } = &region.kind {
                    seen.insert(key.clone());
                }
                collect(
                    children,
                    seen,
                    ignored || matches!(region.kind, RegionKind::Ignore { .. }),
                )?;
            }
            Node::Element(element) => collect(&element.children, seen, ignored)?,
            _ => {}
        }
    }
    Ok(())
}

pub(crate) fn component_order(nodes: &[Node], paths: &mut Vec<String>) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Instance { path, .. } = &region.kind
                    && !paths.contains(path)
                {
                    paths.push(path.clone());
                }
                component_order(children, paths);
            }
            Node::Element(element) => component_order(&element.children, paths),
            _ => {}
        }
    }
}

fn acyclic(edges: BTreeMap<&str, Option<&str>>) -> Result<()> {
    let mut complete = BTreeSet::new();
    for start in edges.keys() {
        let mut path = BTreeSet::new();
        let mut current = Some(*start);
        while let Some(key) = current.filter(|key| !complete.contains(key)) {
            if !path.insert(key) {
                return Err(invalid(
                    "build-invalid",
                    "fragment input scope contains a cycle",
                ));
            }
            current = edges.get(key).copied().flatten();
        }
        complete.extend(path);
    }
    Ok(())
}
