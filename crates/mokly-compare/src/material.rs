//! Canonical owned trees with paired ignores, component boundaries, and logical links.

use std::collections::{BTreeMap, BTreeSet};

use mokly_html::tree::{self, Element, Node, RegionKind};
use mokly_model::canonical::compare_utf16;
use mokly_model::usage::ComponentInputOwner;

use crate::instance_inputs::{SlotInputs, SlotSignal};
use crate::{material_nodes, material_urls};

/// Typed canonical material, never used as captured document bytes.
#[derive(Eq)]
pub(crate) enum Material {
    Element(String, String, Vec<(String, String)>, Vec<Material>),
    Text(String),
    Comment(String),
    Doctype(String),
    Instance(String, String, String, String, Vec<SlotSignal>),
    SlotBoundary(String),
    Ignore(String, Option<String>),
    Slot(String, Vec<Material>),
}

/// Equality options are private to one paired view or move candidate.
#[derive(Clone, Default)]
pub(crate) struct Projection {
    pub(crate) inputs: SlotInputs,
    pub(crate) instance_owner: Option<String>,
    pub(crate) ignored: BTreeSet<String>,
    pub(crate) instances: BTreeSet<String>,
    pub(crate) paths: BTreeMap<String, String>,
    pub(crate) resources: BTreeMap<String, String>,
    pub(crate) route: String,
}

/// Canonicalize one composed tree without retaining it or changing output bytes.
pub(crate) fn canonical(nodes: &[Node], projection: &Projection) -> Vec<Material> {
    material_nodes::canonical(nodes, projection)
}

pub(crate) fn ignores(nodes: &[Node]) -> BTreeSet<String> {
    let mut ids = BTreeSet::new();
    visit(nodes, &mut |kind| {
        if let RegionKind::Ignore { id, .. } = kind {
            ids.insert(id.clone());
        }
    });
    ids
}

pub(crate) fn ignore_contract(nodes: &[Node]) -> Vec<(String, bool)> {
    let mut ids = Vec::new();
    visit(nodes, &mut |kind| {
        if let RegionKind::Ignore { id, material_key } = kind {
            ids.push((id.clone(), material_key.is_some()));
        }
    });
    ids
}

pub(crate) fn instances(
    nodes: &[Node],
    paths: &BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let mut instances = BTreeMap::new();
    visit(nodes, &mut |kind| {
        if let RegionKind::Instance { key, path, .. } = kind {
            instances.insert(key.clone(), mapped(path, paths));
        }
    });
    instances
}

fn visit(nodes: &[Node], callback: &mut dyn FnMut(&RegionKind)) {
    for node in tree::walk(nodes) {
        if let Node::Region { region, .. } = node {
            callback(&region.kind);
        }
    }
}

/// Test whether a supplied slot belongs to this projection input owner.
pub(crate) fn owns(projection: &Projection, owner: &ComponentInputOwner) -> bool {
    match (owner, projection.instance_owner.as_deref()) {
        (ComponentInputOwner::Entry, None) => true,
        (ComponentInputOwner::Instance { instance_key }, Some(key)) => instance_key == key,
        _ => false,
    }
}

/// Normalize and sort attributes without changing rendered output.
pub(crate) fn attributes(element: &Element, projection: &Projection) -> Vec<(String, String)> {
    let mut attributes: Vec<_> = element
        .attributes
        .iter()
        .filter_map(|attribute| {
            let name = attribute.name.to_ascii_lowercase();
            if name.starts_with("data-mokly-")
                && matches!(name.as_str(), "data-mokly-link" | "data-mokly-target")
            {
                return None;
            }
            let value = if matches!(name.as_str(), "href" | "data-nav-href")
                && element.navigation.is_some()
            {
                element
                    .navigation
                    .as_ref()
                    .map_or(attribute.value.clone(), |reference| {
                        format!(
                            "mock:{}{}",
                            mapped(&reference.target, &projection.paths),
                            reference
                                .fragment
                                .as_ref()
                                .map_or(String::new(), |fragment| format!("#{fragment}"))
                        )
                    })
            } else if matches!(
                name.as_str(),
                "href" | "src" | "poster" | "data" | "xlink:href"
            ) {
                material_urls::url(&attribute.value, &projection.route, &projection.resources)
            } else if name == "srcset" {
                material_urls::srcset(&attribute.value, &projection.route, &projection.resources)
            } else if name == "style" {
                material_urls::css(&attribute.value, &projection.route, &projection.resources)
            } else {
                attribute.value.clone()
            };
            Some((name, value))
        })
        .collect();
    attributes.sort_by(|left, right| compare_utf16(&left.0, &right.0));
    attributes
}

/// Collapse each ASCII whitespace run outside a raw-text scope.
pub(crate) fn whitespace(text: &str) -> String {
    let mut output = String::new();
    let mut space = false;
    for character in text.chars() {
        if matches!(character, ' ' | '\t' | '\n' | '\r' | '\u{000c}') {
            if !space {
                output.push(' ');
            }
            space = true;
        } else {
            output.push(character);
            space = false;
        }
    }
    output
}

pub(crate) fn mapped(path: &str, paths: &BTreeMap<String, String>) -> String {
    paths
        .get(&path.to_ascii_lowercase())
        .cloned()
        .unwrap_or_else(|| path.into())
}

#[cfg(test)]
#[path = "_tests_/material_tests.rs"]
mod material_tests;
