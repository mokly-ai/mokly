//! Conservative accounting for every cache-retained parsed tree and record.

use std::mem;

use mokly_html::composition::Composed;
use mokly_html::fragment::{Fragment, StyleAttribution};
use mokly_html::links::Reference;
use mokly_html::tree;
use mokly_html::tree::{Node, RegionKind};

pub(crate) fn document(document: &Composed) -> usize {
    let usage =
        serde_json::to_vec(&document.usage).map_or(0, |bytes| bytes.len().saturating_mul(64));
    mem::size_of::<Composed>()
        + nodes(&document.tree)
        + usage
        + document.links.capacity() * mem::size_of::<Reference>()
        + document
            .links
            .iter()
            .map(|link| {
                link.source_route.capacity()
                    + link.target.capacity()
                    + link.fragment.as_ref().map_or(0, String::capacity)
            })
            .sum::<usize>()
        + document
            .warnings
            .iter()
            .map(|warning| {
                mem::size_of_val(warning)
                    + warning.message.capacity()
                    + warning.printed_subject().len() * 2
            })
            .sum::<usize>()
        + document
            .resources
            .iter()
            .chain(&document.components)
            .map(|value| mem::size_of::<String>() + value.capacity())
            .sum::<usize>()
}

pub(crate) fn fragment(fragment: &Fragment) -> usize {
    let instances =
        serde_json::to_vec(&fragment.instances).map_or(0, |bytes| bytes.len().saturating_mul(64));
    let slots =
        serde_json::to_vec(&fragment.slots).map_or(0, |bytes| bytes.len().saturating_mul(64));
    mem::size_of::<Fragment>()
        + fragment.html.capacity()
        + fragment
            .markers
            .iter()
            .map(|marker| {
                mem::size_of_val(marker)
                    + marker.id.capacity()
                    + marker.parent_id.as_ref().map_or(0, String::capacity)
                    + format!("{:?}", marker.kind).len()
            })
            .sum::<usize>()
        + instances
        + slots
        + fragment
            .styles
            .iter()
            .map(|style| {
                mem::size_of_val(style)
                    + style.css.capacity()
                    + style_attribution(&style.attribution)
                    + style
                        .owners
                        .iter()
                        .map(|owner| owner.capacity() + mem::size_of::<String>())
                        .sum::<usize>()
            })
            .sum::<usize>()
        + fragment
            .resources
            .iter()
            .map(|path| path.capacity() + mem::size_of::<String>())
            .sum::<usize>()
        + fragment
            .warnings
            .iter()
            .map(|warning| warning.message.capacity() + warning.printed_subject().len() * 2 + 128)
            .sum::<usize>()
}

fn nodes(values: &Vec<Node>) -> usize {
    let mut total = 0;
    let mut pending = vec![values];
    while let Some(values) = pending.pop() {
        total += values.capacity() * mem::size_of::<Node>();
        for node in values {
            total += match node {
                Node::Text(text) | Node::Comment(text) | Node::Doctype(text) => text.capacity(),
                Node::Element(element) => {
                    pending.push(&element.children);
                    element.style_owners.as_ref().map_or(0, |owners| {
                        owners.capacity() * mem::size_of::<String>()
                            + owners.iter().map(String::capacity).sum::<usize>()
                    }) + style_attribution(&element.style_attribution)
                        + element.name.capacity()
                        + element.namespace.capacity()
                        + element.origin.as_ref().map_or(0, String::capacity)
                        + element.source.as_ref().map_or(0, |source| {
                            source.path.capacity()
                                + source.export.as_ref().map_or(0, String::capacity)
                        })
                        + element.navigation.as_ref().map_or(0, |link| {
                            link.source_route.capacity()
                                + link.target.capacity()
                                + link.fragment.as_ref().map_or(0, String::capacity)
                        })
                        + element.attributes.capacity() * mem::size_of::<tree::Attribute>()
                        + element
                            .attributes
                            .iter()
                            .map(|a| a.name.capacity() + a.value.capacity())
                            .sum::<usize>()
                }
                Node::Region { region, children } => {
                    pending.push(children);
                    region.id.capacity()
                        + match &region.kind {
                            RegionKind::Root { path } => path.capacity(),
                            RegionKind::Instance {
                                path,
                                key,
                                local_id,
                                props_key,
                            } => {
                                path.capacity()
                                    + key.capacity()
                                    + local_id.capacity()
                                    + props_key.capacity()
                            }
                            RegionKind::Slot {
                                key,
                                name,
                                instance_key,
                                owner,
                            } => {
                                key.capacity()
                                    + name.capacity()
                                    + instance_key.capacity()
                                    + format!("{owner:?}").len()
                            }
                            RegionKind::Ignore { id, material_key } => {
                                id.capacity() + material_key.as_ref().map_or(0, String::capacity)
                            }
                        }
                }
            };
        }
    }
    total
}

fn style_attribution(records: &Option<Vec<StyleAttribution>>) -> usize {
    records.as_ref().map_or(0, |records| {
        records.capacity() * mem::size_of::<StyleAttribution>()
            + records
                .iter()
                .map(|record| {
                    record.css.capacity()
                        + record.owners.capacity() * mem::size_of::<String>()
                        + record.owners.iter().map(String::capacity).sum::<usize>()
                })
                .sum::<usize>()
    })
}
