//! Reparse composed bytes and restore only sibling regions the browser can inspect.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::{EntryContent, ModelEntry, SourceLocation};
use mokly_model::usage::CatalogueUsage;

use crate::composition::Composed;
use crate::error::Result;
use crate::links::{self, Reference};
use crate::normalized_regions;
use crate::tree::{Element, Node, Region, RegionKind};
use crate::{normalized_usage, parse, regions, serialize};

pub(crate) const ATTRIBUTE: &str = "data-mokly-normalize";
const PREFIX: &str = "mokly-normalize:";

pub(crate) struct Metadata {
    pub(crate) style_owners: Option<Vec<String>>,
    pub(crate) origin: Option<String>,
    pub(crate) navigation: Option<Reference>,
    pub(crate) source: Option<SourceLocation>,
    pub(crate) previous: Option<String>,
    pub(crate) parent: String,
    pub(crate) owner: Option<String>,
}

pub(crate) struct Placement {
    pub(crate) region: Region,
    pub(crate) parent: String,
    pub(crate) parent_name: String,
    pub(crate) enclosing: Option<String>,
}

#[derive(Default)]
pub(crate) struct Repair {
    pub(crate) elements: BTreeMap<String, Metadata>,
    pub(crate) regions: BTreeMap<String, Placement>,
    pub(crate) moved: BTreeSet<String>,
    pub(crate) valid: BTreeSet<String>,
}

/// Repair the final adapted document before usage and comparison can consume it.
pub fn composed(
    document: &mut Composed,
    entry: &ModelEntry,
    catalogue: &PreparedCatalogue,
) -> Result<()> {
    let (tree, warnings) = reparse(mem::take(&mut document.tree), entry, catalogue);
    document.tree = tree;
    document.warnings.extend(warnings);
    if let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &mut document.usage
    {
        let mut instance_map = mem::take(instances)
            .into_iter()
            .map(|record| (record.key.clone(), record))
            .collect();
        let mut slot_map = mem::take(slots)
            .into_iter()
            .map(|record| (record.key.clone(), record))
            .collect();
        normalized_usage::rebuild(&mut document.tree, &mut instance_map, &mut slot_map)?;
        *instances = instance_map.into_values().collect();
        *slots = slot_map.into_values().collect();
        regions::validate(&document.tree)?;
        *ranges = regions::number(&mut document.tree);
    }
    document.links = links::references(&document.tree);
    Ok(())
}

fn reparse(
    nodes: Vec<Node>,
    entry: &ModelEntry,
    catalogue: &PreparedCatalogue,
) -> (Vec<Node>, Vec<Warning>) {
    let mut repair = Repair::default();
    let marked = annotate(nodes, "document", "document", None, &mut repair);
    let mut parsed = parse::document(&serialize::html(&marked));
    normalized_regions::classify(&parsed, &mut repair);
    parsed = normalized_regions::restore(parsed, &mut repair);
    let warnings = repair
        .moved
        .iter()
        .filter_map(|id| {
            let placement = repair.regions.get(id)?;
            let mut owner = placement;
            let path = loop {
                match &owner.region.kind {
                    RegionKind::Instance { path, .. } | RegionKind::Root { path } => break path,
                    _ => owner = repair.regions.get(owner.enclosing.as_ref()?)?,
                }
            };
            let name = catalogue
                .elements
                .iter()
                .find(|(_, element)| &element.path == path)
                .map_or(path.as_str(), |(name, _)| name.as_str());
            let subject = entry
                .metadata
                .variant_of
                .as_ref()
                .unwrap_or(&entry.metadata.path)
                .clone();
            Some(Warning {
                code: "html-foster-parented",
                subject: if matches!(entry.content, EntryContent::Component { .. }) {
                    WarningSubject::Component(subject)
                } else {
                    WarningSubject::Entry(subject)
                },
                message: format!(
                    "component element {name} is moved out of <{}> by HTML parsing",
                    placement.parent_name
                ),
            })
        })
        .collect();
    (parsed, warnings)
}

fn annotate(
    nodes: Vec<Node>,
    parent: &str,
    parent_name: &str,
    owner: Option<&str>,
    repair: &mut Repair,
) -> Vec<Node> {
    let mut output = Vec::new();
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                let id = repair.regions.len().to_string();
                repair.regions.insert(
                    id.clone(),
                    Placement {
                        region,
                        parent: parent.into(),
                        parent_name: parent_name.into(),
                        enclosing: owner.map(str::to_owned),
                    },
                );
                output.push(Node::Comment(format!("{PREFIX}{id}:start")));
                output.extend(annotate(children, parent, parent_name, Some(&id), repair));
                output.push(Node::Comment(format!("{PREFIX}{id}:end")));
            }
            Node::Element(mut element) => {
                let id = repair.elements.len().to_string();
                let previous = element.take(ATTRIBUTE);
                repair.elements.insert(
                    id.clone(),
                    Metadata {
                        style_owners: element.style_owners.take(),
                        origin: element.origin.take(),
                        navigation: element.navigation.take(),
                        source: element.source.take(),
                        previous,
                        parent: parent.into(),
                        owner: owner.map(str::to_owned),
                    },
                );
                element.set(ATTRIBUTE, &id);
                element.children = annotate(
                    mem::take(&mut element.children),
                    &id,
                    &element.name,
                    owner,
                    repair,
                );
                output.push(Node::Element(element));
            }
            node => output.push(node),
        }
    }
    output
}

pub(crate) fn marker(node: &Node) -> Option<(&str, bool)> {
    let Node::Comment(text) = node else {
        return None;
    };
    let (id, edge) = text.strip_prefix(PREFIX)?.split_once(':')?;
    Some((id, edge == "start"))
}

pub(crate) fn metadata(element: &mut Element, repair: &Repair) {
    if let Some(id) = element.take(ATTRIBUTE)
        && let Some(metadata) = repair.elements.get(&id)
    {
        element.style_owners = metadata.style_owners.clone();
        element.origin = metadata.origin.clone();
        element.navigation = metadata.navigation.clone();
        element.source = metadata.source.clone();
        if let Some(previous) = &metadata.previous {
            element.set(ATTRIBUTE, previous);
        }
    }
}
