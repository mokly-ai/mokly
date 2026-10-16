//! Selector matches retain exact instance keys before parsed trees are released.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::rule_matching::DocumentMatching;
use mokly_html::tree::{Node, RegionKind};
use mokly_model::review_affected::ReviewSide;

use crate::material::mapped;

type Index = Vec<Vec<(String, String)>>;

pub(crate) fn index(nodes: &[Node], paths: &BTreeMap<String, String>) -> Index {
    let mut result = Vec::new();
    walk(nodes, paths, &[], &mut result);
    result
}

fn walk(
    nodes: &[Node],
    paths: &BTreeMap<String, String>,
    instances: &[(String, String)],
    output: &mut Index,
) {
    for node in nodes {
        match node {
            Node::Region { region, children } => {
                if matches!(region.kind, RegionKind::Ignore { .. }) {
                    continue;
                }
                let mut instances = instances.to_vec();
                if let RegionKind::Instance { path, key, .. } = &region.kind {
                    instances.push((mapped(path, paths), key.clone()));
                }
                walk(children, paths, &instances, output);
            }
            Node::Element(element) => {
                output.push(instances.to_vec());
                if element.name != "template" {
                    walk(&element.children, paths, instances, output);
                }
            }
            _ => {}
        }
    }
}

pub(crate) fn matched(
    matching: &DocumentMatching,
    owner: &str,
    indices: &[Index; 2],
) -> BTreeSet<String> {
    let all = || {
        indices
            .iter()
            .flatten()
            .flatten()
            .filter(|(path, _)| path == owner)
            .map(|(_, key)| key.clone())
            .collect::<BTreeSet<_>>()
    };
    let DocumentMatching::Resolved(rules) = matching else {
        return all();
    };
    let mut output = BTreeSet::new();
    for selector in rules.iter().flat_map(|rule| &rule.selectors) {
        if selector.unresolved {
            output.extend(all());
            continue;
        }
        for element in &selector.elements {
            let side = if element.side == ReviewSide::Before {
                0
            } else {
                1
            };
            if let Some(instances) = indices[side].get(element.element) {
                output.extend(
                    instances
                        .iter()
                        .filter(|(path, _)| path == owner)
                        .map(|(_, key)| key.clone()),
                );
            }
        }
    }
    output
}
