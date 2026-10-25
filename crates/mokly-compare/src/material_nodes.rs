//! Heap frames preserve canonical child boundaries and caller-slot collection order.

use std::collections::{BTreeMap, BTreeSet};
use std::slice;

use mokly_html::tree::{Element, Node, RegionKind};

use crate::material::{Material, Projection, attributes, mapped, owns, whitespace};

enum Finish<'a> {
    Extend,
    Element(&'a Element, String),
    Slot(&'a str),
}

struct Frame<'a> {
    nodes: slice::Iter<'a, Node>,
    raw: bool,
    head: bool,
    scan: bool,
    finish: Finish<'a>,
    output: Vec<Material>,
}

impl<'a> Frame<'a> {
    fn new(nodes: &'a [Node], raw: bool, head: bool, scan: bool, finish: Finish<'a>) -> Self {
        Self {
            nodes: nodes.iter(),
            raw,
            head,
            scan,
            finish,
            output: Vec::new(),
        }
    }
}

/// Project rendered siblings with explicit return actions for every nested scope.
pub(crate) fn canonical(nodes: &[Node], projection: &Projection) -> Vec<Material> {
    let mut instances = BTreeSet::new();
    let mut slots = BTreeMap::new();
    let mut frames = vec![Frame::new(nodes, false, false, false, Finish::Extend)];
    while let Some(frame) = frames.last_mut() {
        let Some(node) = frame.nodes.next() else {
            let Some(frame) = frames.pop() else { break };
            let Some(parent) = frames.last_mut() else {
                let mut output = frame.output;
                output.extend(
                    slots
                        .into_iter()
                        .map(|(key, nodes)| Material::Slot(key, nodes)),
                );
                return output;
            };
            match frame.finish {
                Finish::Extend => parent.output.extend(frame.output),
                Finish::Element(element, name) => parent.output.push(Material::Element(
                    element.namespace.clone(),
                    name,
                    attributes(element, projection),
                    frame.output,
                )),
                Finish::Slot(key) => {
                    slots.insert(key.into(), frame.output);
                }
            }
            continue;
        };
        let (raw, head) = (frame.raw, frame.head);
        if frame.scan {
            match node {
                Node::Region { region, children } => {
                    if let RegionKind::Slot { key, owner, .. } = &region.kind
                        && owns(projection, owner)
                    {
                        if !slots.contains_key(key) {
                            frames.push(Frame::new(children, raw, head, false, Finish::Slot(key)));
                        }
                    } else {
                        frames.push(Frame::new(children, raw, head, true, Finish::Extend));
                    }
                }
                Node::Element(element) => frames.push(Frame::new(
                    &element.children,
                    raw || matches!(
                        element.name.as_str(),
                        "pre" | "textarea" | "script" | "style"
                    ),
                    head || element.name == "head",
                    true,
                    Finish::Extend,
                )),
                _ => {}
            }
            continue;
        }
        match node {
            Node::Region { region, children } => match &region.kind {
                RegionKind::Ignore { id, material_key } if projection.ignored.contains(id) => {
                    frame
                        .output
                        .push(Material::Ignore(id.clone(), material_key.clone()));
                }
                RegionKind::Slot { owner, name, .. }
                    if projection.instance_owner.is_some() && !owns(projection, owner) =>
                {
                    frame.output.push(Material::SlotBoundary(name.clone()));
                }
                RegionKind::Instance {
                    key,
                    path,
                    local_id,
                    props_key,
                } => {
                    if instances.insert(key.clone()) {
                        frame.output.push(Material::Instance(
                            key.clone(),
                            mapped(path, &projection.paths),
                            local_id.clone(),
                            props_key.clone(),
                            projection.inputs.get(key).cloned().unwrap_or_default(),
                        ));
                    }
                    frames.push(Frame::new(
                        children,
                        raw,
                        head,
                        projection.instances.contains(key),
                        Finish::Extend,
                    ));
                }
                _ => frames.push(Frame::new(children, raw, head, false, Finish::Extend)),
            },
            Node::Element(element) => {
                let name = element.name.to_ascii_lowercase();
                if head && name == "style" {
                    continue;
                }
                frames.push(Frame::new(
                    &element.children,
                    raw || matches!(name.as_str(), "pre" | "textarea" | "script" | "style"),
                    head || name == "head",
                    false,
                    Finish::Element(element, name),
                ));
            }
            Node::Text(text) => {
                let text = if raw { text.clone() } else { whitespace(text) };
                if let Some(Material::Text(previous)) = frame.output.last_mut() {
                    previous.push_str(&text);
                } else if !text.is_empty() {
                    frame.output.push(Material::Text(text));
                }
            }
            Node::Comment(text) if !text.trim_start().starts_with("mokly-") => {
                frame.output.push(Material::Comment(text.clone()));
            }
            Node::Doctype(text) => frame
                .output
                .push(Material::Doctype(text.to_ascii_lowercase())),
            _ => {}
        }
    }
    Vec::new()
}
