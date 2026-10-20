//! Adapt composed ownership annotations to the pure CSS document arena.

use std::collections::BTreeMap;
use std::mem;

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
    context.walk(nodes, None, &[], &EvidenceOwner::Entry);
    tree
}

pub(crate) fn embedded(
    nodes: &[Node],
    regions: &[Containment],
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
        regions: &[Containment],
        owner: &EvidenceOwner,
    ) {
        let mut regions = regions.to_vec();
        let mut inputs: Vec<_> = regions
            .iter()
            .cloned()
            .map(|region| InputRegion {
                region,
                instance_key: None,
            })
            .collect();
        let mut owner = owner.clone();
        let mut pending: Vec<_> = nodes
            .iter()
            .rev()
            .map(|node| Step::Node(node, parent))
            .collect();
        while let Some(step) = pending.pop() {
            let (node, parent) = match step {
                Step::Node(node, parent) => (node, parent),
                Step::Restore(length, previous, input) => {
                    regions.truncate(length);
                    owner = previous;
                    match input {
                        InputRestore::Truncate(length) => inputs.truncate(length),
                        InputRestore::Replace(previous) => inputs = previous,
                    }
                    continue;
                }
            };
            match node {
                Node::Region { region, children } => {
                    let length = regions.len();
                    let mut input = InputRestore::Truncate(inputs.len());
                    let next_owner = match &region.kind {
                        RegionKind::Ignore { .. } => continue,
                        RegionKind::Root { path } | RegionKind::Instance { path, .. } => {
                            let path = mapped(path, self.paths);
                            let containment = Containment {
                                path: path.clone(),
                                root: matches!(region.kind, RegionKind::Root { .. }),
                            };
                            regions.push(containment.clone());
                            inputs.push(InputRegion {
                                region: containment,
                                instance_key: match &region.kind {
                                    RegionKind::Instance { key, .. } => Some(key.clone()),
                                    _ => None,
                                },
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
                        RegionKind::Slot { .. } => regions
                            .iter()
                            .find(|region| region.root)
                            .map_or(EvidenceOwner::Entry, |region| EvidenceOwner::Component {
                                path: region.path.clone(),
                            }),
                    };
                    if let RegionKind::Slot {
                        owner: supplier, ..
                    } = &region.kind
                    {
                        let mut supplied = inputs.clone();
                        if matches!(supplier, ComponentInputOwner::Entry) {
                            supplied.retain(|input| input.region.root);
                        } else if let ComponentInputOwner::Instance { instance_key } = supplier {
                            supplied.truncate(
                                supplied
                                    .iter()
                                    .rposition(|input| {
                                        input.instance_key.as_ref() == Some(instance_key)
                                    })
                                    .map_or(0, |index| index + 1),
                            );
                        } else {
                            supplied.clear();
                        }
                        input = InputRestore::Replace(mem::replace(&mut inputs, supplied));
                    }
                    pending.push(Step::Restore(length, owner, input));
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
                        regions: regions.to_vec(),
                        input_regions: inputs.iter().map(|input| input.region.clone()).collect(),
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
    Restore(usize, EvidenceOwner, InputRestore),
}

enum InputRestore {
    Truncate(usize),
    Replace(Vec<InputRegion>),
}

/// A component path can repeat; a slot always selects its exact supplier instance.
#[derive(Clone)]
struct InputRegion {
    region: Containment,
    instance_key: Option<String>,
}

#[cfg(test)]
#[path = "_tests_/matching_tree_tests.rs"]
mod matching_tree_tests;
