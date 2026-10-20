//! Adapt composed ownership annotations to the pure CSS document arena.

use std::collections::BTreeMap;

use mokly_css::containment::ContainmentPath;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_html::tree::{Node, RegionKind};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

use crate::material::{instances, mapped};

pub(crate) fn document(nodes: &[Node], paths: &BTreeMap<String, String>) -> MatchTree {
    let mut tree = MatchTree::default();
    let instances = instances(nodes, paths);
    let mut context = Context {
        tree: &mut tree,
        instances: &instances,
        paths,
    };
    context.walk(
        nodes,
        None,
        &ContainmentPath::default(),
        &EvidenceOwner::Entry,
    );
    tree
}

pub(crate) fn embedded(
    nodes: &[Node],
    regions: &ContainmentPath,
    owner: &EvidenceOwner,
) -> MatchTree {
    let mut tree = MatchTree::default();
    Context {
        tree: &mut tree,
        instances: &BTreeMap::new(),
        paths: &BTreeMap::new(),
    }
    .walk(nodes, None, regions, owner);
    tree
}

struct Context<'a> {
    tree: &'a mut MatchTree,
    instances: &'a BTreeMap<String, String>,
    paths: &'a BTreeMap<String, String>,
}

impl Context<'_> {
    fn walk(
        &mut self,
        nodes: &[Node],
        parent: Option<usize>,
        regions: &ContainmentPath,
        owner: &EvidenceOwner,
    ) {
        let mut regions = regions.clone();
        let mut owner = owner.clone();
        let mut pending: Vec<_> = nodes
            .iter()
            .rev()
            .map(|node| Step::Node(node, parent))
            .collect();
        while let Some(step) = pending.pop() {
            let (node, parent) = match step {
                Step::Node(node, parent) => (node, parent),
                Step::Restore(previous_regions, previous) => {
                    regions = previous_regions;
                    owner = previous;
                    continue;
                }
            };
            match node {
                Node::Region { region, children } => {
                    let previous_regions = regions.clone();
                    let next_owner = match &region.kind {
                        RegionKind::Ignore { .. } => continue,
                        RegionKind::Root { path } | RegionKind::Instance { path, .. } => {
                            let path = mapped(path, self.paths);
                            regions = regions.with_region(Containment {
                                path: path.clone(),
                                root: matches!(region.kind, RegionKind::Root { .. }),
                            });
                            EvidenceOwner::Component { path }
                        }
                        RegionKind::Slot {
                            owner: ComponentInputOwner::Instance { instance_key },
                            ..
                        } => self
                            .instances
                            .get(instance_key)
                            .map_or(EvidenceOwner::Entry, |path| EvidenceOwner::Component {
                                path: path.clone(),
                            }),
                        RegionKind::Slot { .. } => EvidenceOwner::Entry,
                    };
                    pending.push(Step::Restore(previous_regions, owner));
                    owner = next_owner;
                    pending.extend(children.iter().rev().map(|node| Step::Node(node, parent)));
                }
                Node::Element(element) => {
                    let index = self.tree.elements.len();
                    self.tree.elements.push(MatchElement {
                        name: element.name.clone(),
                        namespace: element.namespace.clone(),
                        attributes: element
                            .attributes
                            .iter()
                            .map(|attribute| (attribute.name.clone(), attribute.value.clone()))
                            .collect(),
                        parent,
                        children: Vec::new(),
                        text: false,
                        regions: regions.clone(),
                        owner: owner.clone(),
                    });
                    if let Some(parent) = parent {
                        self.tree.elements[parent].children.push(index);
                    }
                    if element.name != "template" {
                        pending.extend(
                            element
                                .children
                                .iter()
                                .rev()
                                .map(|node| Step::Node(node, Some(index))),
                        );
                    }
                }
                Node::Text(text) if !text.is_empty() => {
                    if let Some(parent) = parent {
                        self.tree.elements[parent].text = true;
                    }
                }
                _ => {}
            }
        }
    }
}

enum Step<'a> {
    Node(&'a Node, Option<usize>),
    Restore(ContainmentPath, EvidenceOwner),
}

#[cfg(test)]
#[path = "_tests_/matching_tree_tests.rs"]
mod matching_tree_tests;
