//! Conservative accounting for every cache-retained parsed tree and record.

use std::mem;

use mokly_html::composition::Composed;
use mokly_html::fragment::Fragment;
use mokly_html::tree;
use mokly_html::tree::{Node, RegionKind};

pub(crate) fn document(document: &Composed) -> usize {
    let usage =
        serde_json::to_vec(&document.usage).map_or(0, |bytes| bytes.len().saturating_mul(64));
    mem::size_of::<Composed>()
        + nodes(&document.tree)
        + usage
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
                style.css.capacity()
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
    values.capacity() * mem::size_of::<Node>()
        + values
            .iter()
            .map(|node| match node {
                Node::Text(text) | Node::Comment(text) | Node::Doctype(text) => text.capacity(),
                Node::Element(element) => {
                    element.name.capacity()
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
                        + nodes(&element.children)
                }
                Node::Region { region, children } => {
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
                        + nodes(children)
                }
            })
            .sum::<usize>()
}
