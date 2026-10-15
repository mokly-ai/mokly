//! Relative catalogue links use the body definition's base, including through slots.

use std::collections::BTreeMap;

use mokly_model::catalogue::{EntryMetadata, ModelEntry};
use mokly_model::paths::is_entry_path;
use mokly_model::routes;
use mokly_model::usage::ComponentInputOwner;

use crate::error::{Result, invalid};
use crate::fragment::Fragment;
use crate::tree::{Element, Node, RegionKind};

pub(crate) fn base(metadata: &EntryMetadata) -> String {
    if metadata.is_index {
        metadata.path.clone()
    } else {
        metadata
            .path
            .rsplit_once('/')
            .map_or("", |(path, _)| path)
            .into()
    }
}

pub(crate) fn destination(path: &str, base: &str) -> Result<String> {
    let complete = if path.starts_with("./") || path.starts_with("../") {
        routes::resolve(format!("{base}/index.html").trim_start_matches('/'), path)
    } else {
        Some(path.into())
    };
    complete.filter(|path| is_entry_path(path)).ok_or_else(|| {
        invalid(
            "html-attribute",
            format!("invalid logical destination {path:?}"),
        )
    })
}

pub(crate) fn element(element: &mut Element, base: &str) -> Result<()> {
    for attribute in &mut element.attributes {
        if let Some(logical) = attribute
            .value
            .strip_prefix("mock:")
            .filter(|_| matches!(attribute.name.as_str(), "href" | "data-nav-href"))
        {
            let (path, fragment) = logical
                .split_once('#')
                .map_or((logical, None), |(path, fragment)| (path, Some(fragment)));
            attribute.value = format!(
                "mock:{}{}",
                destination(path, base)?,
                fragment.map_or(String::new(), |fragment| format!("#{fragment}"))
            );
        } else if attribute.name == "to" {
            attribute.value = destination(&attribute.value, base)?;
        }
    }
    Ok(())
}

pub(crate) fn fragment(
    nodes: &mut [Node],
    root: &str,
    fragment: &Fragment,
    entries: &[ModelEntry],
) -> Result<()> {
    let bases: BTreeMap<_, _> = entries
        .iter()
        .filter(|entry| entry.metadata.variant_of.is_none())
        .map(|entry| (entry.metadata.path.as_str(), base(&entry.metadata)))
        .collect();
    let owners: BTreeMap<_, _> = fragment
        .instances
        .iter()
        .map(|instance| (instance.key.as_str(), instance.component_id.as_str()))
        .collect();
    walk(nodes, root, root, &bases, &owners)
}

fn walk(
    nodes: &mut [Node],
    current: &str,
    root: &str,
    bases: &BTreeMap<&str, String>,
    owners: &BTreeMap<&str, &str>,
) -> Result<()> {
    for node in nodes {
        match node {
            Node::Element(node) => {
                element(node, current)?;
                walk(&mut node.children, current, root, bases, owners)?;
            }
            Node::Region { region, children } => {
                let scope = match &region.kind {
                    RegionKind::Instance { path, .. } | RegionKind::Root { path } => {
                        bases.get(path.as_str()).map_or(current, String::as_str)
                    }
                    RegionKind::Slot {
                        owner: ComponentInputOwner::Entry,
                        ..
                    } => root,
                    RegionKind::Slot {
                        owner: ComponentInputOwner::Instance { instance_key },
                        ..
                    } => owners
                        .get(instance_key.as_str())
                        .and_then(|path| bases.get(path))
                        .map_or(current, String::as_str),
                    _ => current,
                };
                walk(children, scope, root, bases, owners)?;
            }
            _ => {}
        }
    }
    Ok(())
}
