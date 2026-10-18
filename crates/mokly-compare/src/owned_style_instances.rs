//! Selector matches retain exact instance keys before parsed trees are released.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::rule_matching::DocumentMatching;
use mokly_html::tree::{Node, RegionKind};
use mokly_model::review_affected::ReviewSide;

use crate::material::mapped;

struct Instance {
    path: String,
    key: String,
    parent: Option<usize>,
}

/// Elements share their enclosing instance chain through arena indices.
#[derive(Default)]
pub(crate) struct Index {
    elements: Vec<Option<usize>>,
    instances: Vec<Instance>,
}

pub(crate) fn index(nodes: &[Node], paths: &BTreeMap<String, String>) -> Index {
    let mut result = Index::default();
    let mut pending: Vec<_> = nodes.iter().rev().map(|node| (node, None)).collect();
    while let Some((node, parent)) = pending.pop() {
        match node {
            Node::Region { region, children } => {
                if matches!(region.kind, RegionKind::Ignore { .. }) {
                    continue;
                }
                let parent = if let RegionKind::Instance { path, key, .. } = &region.kind {
                    let index = result.instances.len();
                    result.instances.push(Instance {
                        path: mapped(path, paths),
                        key: key.clone(),
                        parent,
                    });
                    Some(index)
                } else {
                    parent
                };
                pending.extend(children.iter().rev().map(|node| (node, parent)));
            }
            Node::Element(element) => {
                result.elements.push(parent);
                if element.name != "template" {
                    pending.extend(element.children.iter().rev().map(|node| (node, parent)));
                }
            }
            _ => {}
        }
    }
    result
}

impl Index {
    fn collect(
        &self,
        mut parent: Option<usize>,
        owner: &str,
        seen: &mut BTreeSet<usize>,
        output: &mut BTreeSet<String>,
    ) {
        while let Some(index) = parent {
            if !seen.insert(index) {
                break;
            }
            let instance = &self.instances[index];
            if instance.path == owner {
                output.insert(instance.key.clone());
            }
            parent = instance.parent;
        }
    }
}

pub(crate) fn matched(
    matching: &DocumentMatching,
    owner: &str,
    indices: &[Index; 2],
) -> BTreeSet<String> {
    let all = || {
        let mut output = BTreeSet::new();
        for index in indices {
            let mut seen = BTreeSet::new();
            for parent in &index.elements {
                index.collect(*parent, owner, &mut seen, &mut output);
            }
        }
        output
    };
    let DocumentMatching::Resolved(rules) = matching else {
        return all();
    };
    let mut output = BTreeSet::new();
    let mut seen = [BTreeSet::new(), BTreeSet::new()];
    for selector in rules.iter().flat_map(|rule| &rule.selectors) {
        if selector.unresolved {
            return all();
        }
        for element in &selector.elements {
            let side = if element.side == ReviewSide::Before {
                0
            } else {
                1
            };
            if let Some(parent) = indices[side].elements.get(element.element) {
                indices[side].collect(*parent, owner, &mut seen[side], &mut output);
            }
        }
    }
    output
}

#[cfg(test)]
#[path = "_tests_/owned_style_instances_tests.rs"]
mod owned_style_instances_tests;
