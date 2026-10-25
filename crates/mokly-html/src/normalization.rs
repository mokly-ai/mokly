//! Reparse composed bytes and restore only sibling regions the browser can inspect.

use crate::fragment::StyleAttribution;

use std::collections::{BTreeMap, BTreeSet};
use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::{EntryContent, ModelEntry, SourceLocation};
use mokly_model::usage::CatalogueUsage;

use crate::composition::Composed;
use crate::error::Result;
use crate::links::{self, Reference};
use crate::tree::{self, Element, Node, Region, RegionKind};
use crate::{normalization_annotate, normalized_plaintext, normalized_regions};
use crate::{normalized_usage, parse, regions, serialize};

pub(crate) const ATTRIBUTE: &str = "data-mokly-normalize";
pub(crate) const PREFIX: &str = "mokly-normalize:";

pub(crate) struct Metadata {
    pub(crate) style_owners: Option<Vec<String>>,
    pub(crate) style_attribution: Option<Vec<StyleAttribution>>,
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
    let source = nodes.clone();
    let mut repair = Repair::default();
    let marked = normalization_annotate::annotate(nodes, &mut repair);
    let serialized = serialize::document(&marked, false);
    let mut parsed = parse::delivered_document(&serialized.html);
    let plaintext_ok = serialized.plaintext.as_ref().is_none_or(|start| {
        confirmed_plaintext(&parsed, &start.id)
            && confirmed_plaintext(
                &parse::delivered_document(&serialized.html[..start.prefix_end]),
                &start.id,
            )
    });
    if !plaintext_ok || !confirmed_raw_text(&parsed, &serialized.raw_text) {
        repair = Repair::default();
        let retry = normalization_annotate::annotate_with_plaintext(source, &mut repair, false);
        parsed =
            parse::delivered_document(&serialize::document_with_options(&retry, true, false).html);
    } else if let Some(start) = &serialized.plaintext {
        normalized_plaintext::close_root(&mut parsed, &repair, &start.id);
    }
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

fn confirmed_plaintext(nodes: &[Node], id: &str) -> bool {
    tree::walk(nodes)
        .find_map(|node| match node {
            Node::Element(element) if element.get(ATTRIBUTE) == Some(id) => Some(element),
            _ => None,
        })
        .is_some_and(|element| element.is_html() && element.name == "plaintext")
}

fn confirmed_raw_text(nodes: &[Node], expected: &[serialize::RawTextStart]) -> bool {
    expected.iter().all(|raw| {
        tree::walk(nodes).any(|node| {
            matches!(
                node,
                Node::Element(element)
                    if element.get(ATTRIBUTE) == Some(raw.id.as_str())
                        && element.is_html()
                        && element.name == raw.name
            )
        })
    })
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
        element.style_attribution = metadata.style_attribution.clone();
        element.origin = metadata.origin.clone();
        element.navigation = metadata.navigation.clone();
        element.source = metadata.source.clone();
        if let Some(previous) = &metadata.previous {
            element.set(ATTRIBUTE, previous);
        }
    }
}

#[cfg(test)]
#[path = "_tests_/plaintext_validation_tests.rs"]
mod plaintext_validation_tests;
