//! Prove component implementation changes at paired instances with unchanged caller inputs.

use std::collections::BTreeMap;

use mokly_html::tree::{Node, RegionKind};

use crate::material::{self, Projection};

pub(crate) struct PairedInstance {
    pub(crate) key: String,
    pub(crate) component: String,
    pub(crate) render_changed: bool,
}

pub(crate) fn collect(
    before: &[Node],
    after: &[Node],
    left: &Projection,
    right: &Projection,
) -> Vec<PairedInstance> {
    let mut before_instances = BTreeMap::new();
    let mut after_instances = BTreeMap::new();
    index(before, &mut before_instances);
    index(after, &mut after_instances);
    let mut impact = Vec::new();
    for (key, (path, props, nodes)) in before_instances {
        let Some((after_path, after_props, after_nodes)) = after_instances.get(key) else {
            continue;
        };
        let path = material::mapped(path, &left.paths);
        if path != *after_path
            || props != *after_props
            || left.inputs.get(key) != right.inputs.get(key)
            || slots(nodes, key, left) != slots(after_nodes, key, right)
        {
            continue;
        }
        let mut left = left.clone();
        let mut right = right.clone();
        left.instance_owner = Some(key.into());
        right.instance_owner = Some(key.into());
        impact.push(PairedInstance {
            key: key.into(),
            component: path,
            render_changed: material::canonical(nodes, &left)
                != material::canonical(after_nodes, &right),
        });
    }
    impact
}

fn index<'a>(nodes: &'a [Node], output: &mut BTreeMap<&'a str, (&'a str, &'a str, &'a [Node])>) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Instance {
                    key,
                    path,
                    props_key,
                    ..
                } = &region.kind
                {
                    output.entry(key).or_insert((path, props_key, children));
                }
                index(children, output);
            }
            Node::Element(element) => index(&element.children, output),
            _ => {}
        }
    }
}

fn slots(
    nodes: &[Node],
    instance: &str,
    projection: &Projection,
) -> BTreeMap<String, Vec<material::Material>> {
    let mut output = BTreeMap::new();
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if let RegionKind::Slot {
                    instance_key, name, ..
                } = &region.kind
                    && instance_key == instance
                {
                    output
                        .entry(name.clone())
                        .or_insert_with(|| material::canonical(children, projection));
                } else {
                    output.extend(slots(children, instance, projection));
                }
            }
            Node::Element(element) => output.extend(slots(&element.children, instance, projection)),
            _ => {}
        }
    }
    output
}
