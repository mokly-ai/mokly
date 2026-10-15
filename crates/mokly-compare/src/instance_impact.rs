//! Prove component implementation changes at paired instances with unchanged caller inputs.

use std::collections::{BTreeMap, BTreeSet};

use mokly_html::tree::{Node, RegionKind};

use crate::material::{self, Projection};

pub(crate) fn collect(
    before: &[Node],
    after: &[Node],
    left: &Projection,
    right: &Projection,
) -> BTreeSet<String> {
    let mut before_instances = BTreeMap::new();
    let mut after_instances = BTreeMap::new();
    index(before, &mut before_instances);
    index(after, &mut after_instances);
    let mut impact = BTreeSet::new();
    for (key, (path, props, nodes)) in before_instances {
        let Some((after_path, after_props, after_nodes)) = after_instances.get(key) else {
            continue;
        };
        let path = material::mapped(path, &left.paths);
        if path != *after_path
            || props != *after_props
            || left.inputs.get(key) != right.inputs.get(key)
        {
            continue;
        }
        let mut left = left.clone();
        let mut right = right.clone();
        left.instance_owner = Some(key.into());
        right.instance_owner = Some(key.into());
        if material::canonical(nodes, &left) != material::canonical(after_nodes, &right) {
            impact.insert(path);
        }
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
