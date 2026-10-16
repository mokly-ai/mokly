//! Canonical owned trees with paired ignores, component boundaries, and logical links.

use std::collections::{BTreeMap, BTreeSet};

use mokly_html::tree::{Element, Node, RegionKind};
use mokly_model::canonical::compare_utf16;
use mokly_model::usage::ComponentInputOwner;
use serde::Serialize;

use crate::instance_inputs::{SlotInputs, SlotSignal};
use crate::material_urls;

/// Typed canonical material, never used as captured document bytes.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
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
    let mut state = State {
        projection,
        instances: BTreeSet::new(),
        slots: BTreeMap::new(),
    };
    let mut output = state.nodes(nodes, false, false);
    output.extend(
        state
            .slots
            .into_iter()
            .map(|(key, nodes)| Material::Slot(key, nodes)),
    );
    output
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
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                callback(&region.kind);
                visit(children, callback);
            }
            Node::Element(element) => visit(&element.children, callback),
            _ => {}
        }
    }
}

struct State<'a> {
    projection: &'a Projection,
    instances: BTreeSet<String>,
    slots: BTreeMap<String, Vec<Material>>,
}

impl State<'_> {
    fn nodes(&mut self, nodes: &[Node], raw: bool, head: bool) -> Vec<Material> {
        let mut output = Vec::new();
        for node in nodes {
            match node {
                Node::Region { region, children } => match &region.kind {
                    RegionKind::Ignore { id, material_key }
                        if self.projection.ignored.contains(id) =>
                    {
                        output.push(Material::Ignore(id.clone(), material_key.clone()));
                    }
                    RegionKind::Slot { owner, name, .. }
                        if self.projection.instance_owner.is_some() && !self.owns(owner) =>
                    {
                        output.push(Material::SlotBoundary(name.clone()));
                    }
                    RegionKind::Instance {
                        key,
                        path,
                        local_id,
                        props_key,
                    } => {
                        if self.instances.insert(key.clone()) {
                            output.push(Material::Instance(
                                key.clone(),
                                mapped(path, &self.projection.paths),
                                local_id.clone(),
                                props_key.clone(),
                                self.projection.inputs.get(key).cloned().unwrap_or_default(),
                            ));
                        }
                        if self.projection.instances.contains(key) {
                            self.slots(children, raw, head);
                        } else {
                            output.extend(self.nodes(children, raw, head));
                        }
                    }
                    _ => output.extend(self.nodes(children, raw, head)),
                },
                Node::Element(element) => {
                    let name = element.name.to_ascii_lowercase();
                    if head && name == "style" {
                        continue;
                    }
                    let attributes = attributes(element, self.projection);
                    let children = self.nodes(
                        &element.children,
                        raw || matches!(name.as_str(), "pre" | "textarea" | "script" | "style"),
                        head || name == "head",
                    );
                    output.push(Material::Element(
                        element.namespace.clone(),
                        name,
                        attributes,
                        children,
                    ));
                }
                Node::Text(text) => {
                    let text = if raw { text.clone() } else { whitespace(text) };
                    if let Some(Material::Text(previous)) = output.last_mut() {
                        previous.push_str(&text);
                    } else if !text.is_empty() {
                        output.push(Material::Text(text));
                    }
                }
                Node::Comment(text) if !text.trim_start().starts_with("mokly-") => {
                    output.push(Material::Comment(text.clone()))
                }
                Node::Doctype(text) => output.push(Material::Doctype(text.to_ascii_lowercase())),
                _ => {}
            }
        }
        output
    }

    fn owns(&self, owner: &ComponentInputOwner) -> bool {
        match (owner, self.projection.instance_owner.as_deref()) {
            (ComponentInputOwner::Entry, None) => true,
            (ComponentInputOwner::Instance { instance_key }, Some(key)) => instance_key == key,
            _ => false,
        }
    }

    fn slots(&mut self, nodes: &[Node], raw: bool, head: bool) {
        for node in nodes {
            match node {
                Node::Region { region, children } => {
                    if let RegionKind::Slot { key, owner, .. } = &region.kind
                        && self.owns(owner)
                    {
                        if !self.slots.contains_key(key) {
                            let material = self.nodes(children, raw, head);
                            self.slots.insert(key.clone(), material);
                        }
                    } else {
                        self.slots(children, raw, head);
                    }
                }
                Node::Element(element) => self.slots(
                    &element.children,
                    raw || matches!(
                        element.name.as_str(),
                        "pre" | "textarea" | "script" | "style"
                    ),
                    head || element.name == "head",
                ),
                _ => {}
            }
        }
    }
}

fn attributes(element: &Element, projection: &Projection) -> Vec<(String, String)> {
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

fn whitespace(text: &str) -> String {
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
