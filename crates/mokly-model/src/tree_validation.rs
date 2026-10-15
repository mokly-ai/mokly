//! Validate current-only public navigation and exact variant placement.

use std::collections::{BTreeMap, BTreeSet};

use crate::paths::{is_entry_path, is_path_segment};
use crate::public_index::{CatalogueNode, CatalogueReadModel};
use crate::public_validation::{entries, invalid};
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;

pub(crate) fn validate(index: &CatalogueReadModel) -> Result<(), ReadError> {
    let entries: BTreeSet<_> = entries(index)
        .iter()
        .map(|entry| entry.path.as_str())
        .collect();
    let variants: BTreeMap<_, _> = index
        .screens
        .iter()
        .filter_map(|entry| {
            entry
                .variant_of
                .as_deref()
                .map(|parent| (entry.entry.path.as_str(), parent))
        })
        .chain(index.components.iter().filter_map(|entry| {
            entry
                .variant_of
                .as_deref()
                .map(|parent| (entry.entry.path.as_str(), parent))
        }))
        .collect();
    let mut seen = BTreeSet::new();
    let mut folders = BTreeSet::new();
    order(index.tree_order.as_deref())?;
    walk(
        &index.tree,
        "",
        &entries,
        &variants,
        &mut seen,
        &mut folders,
        None,
    )?;
    if seen != entries {
        return Err(invalid(ContractViolation::TreeEntries));
    }
    Ok(())
}

fn walk<'a>(
    nodes: &'a [CatalogueNode],
    parent: &str,
    entries: &BTreeSet<&'a str>,
    variants: &BTreeMap<&'a str, &'a str>,
    seen: &mut BTreeSet<&'a str>,
    folders: &mut BTreeSet<&'a str>,
    own_index: Option<&str>,
) -> Result<(), ReadError> {
    for (position, node) in nodes.iter().enumerate() {
        match node {
            CatalogueNode::Folder {
                path,
                title,
                index,
                order: authored,
                children,
                ..
            } => {
                if !is_entry_path(path)
                    || title.trim().is_empty()
                    || children.is_empty()
                    || !folders.insert(path)
                    || !direct(path, parent)
                    || entries.contains(path.as_str()) && index.as_deref() != Some(path)
                {
                    return Err(invalid(ContractViolation::TreeFolder));
                }
                order(authored.as_deref())?;
                if index.as_ref().is_some_and(|index| {
                    index != path
                        || !matches!(children.first(),
                        Some(CatalogueNode::Entry { path, .. }) if path == index)
                }) {
                    return Err(invalid(ContractViolation::TreeIndex));
                }
                walk(
                    children,
                    path,
                    entries,
                    variants,
                    seen,
                    folders,
                    index.as_deref(),
                )?;
            }
            CatalogueNode::Entry {
                path,
                children,
                order: authored,
                ..
            } => {
                if !entries.contains(path.as_str())
                    || !seen.insert(path)
                    || !(direct(path, parent) || position == 0 && own_index == Some(path))
                {
                    return Err(invalid(ContractViolation::TreeEntry));
                }
                if let Some(variant_parent) = variants.get(path.as_str())
                    && (*variant_parent != parent || children.is_some())
                {
                    return Err(invalid(ContractViolation::TreeVariant));
                }
                order(authored.as_deref())?;
                if let Some(children) = children {
                    if children.is_empty() {
                        return Err(invalid(ContractViolation::EmptyChildren));
                    }
                    walk(children, path, entries, variants, seen, folders, None)?;
                }
            }
        }
    }
    Ok(())
}

fn direct(path: &str, parent: &str) -> bool {
    path.rsplit_once('/')
        .map_or(parent.is_empty(), |(prefix, _)| prefix == parent)
}

fn order(items: Option<&[String]>) -> Result<(), ReadError> {
    let mut seen = BTreeSet::new();
    if items
        .into_iter()
        .flatten()
        .any(|item| !seen.insert(item) || (item != "..." && !is_path_segment(item)))
    {
        return Err(invalid(ContractViolation::TreeOrder));
    }
    Ok(())
}
