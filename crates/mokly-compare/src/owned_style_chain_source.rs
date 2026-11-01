//! Temporary source walk for compact owned style ancestry.

use std::collections::BTreeMap;

use mokly_html::tree::{Node, RegionKind};
use mokly_model::usage::ComponentInputOwner;

use crate::material::mapped;

/// One physical instance with separate render and caller input ancestry.
pub(crate) struct Instance {
    pub(crate) path: String,
    pub(crate) key: String,
    pub(crate) parent: Option<usize>,
    pub(crate) input_parent: Option<usize>,
}

/// Full document state used only while a view builds its compact chains.
pub(crate) struct DocumentIndex {
    pub(crate) elements: Vec<(Option<usize>, Option<usize>)>,
    pub(crate) instances: Vec<Instance>,
}

impl DocumentIndex {
    /// Number elements in the same order as CSS matching, skipping inert subtrees.
    pub(crate) fn build(nodes: &[Node], paths: &BTreeMap<String, String>) -> Self {
        let mut result = Self {
            elements: Vec::new(),
            instances: Vec::new(),
        };
        let mut keys = BTreeMap::new();
        let mut pending: Vec<_> = nodes.iter().rev().map(|node| (node, None, None)).collect();
        while let Some((node, parent, input_parent)) = pending.pop() {
            match node {
                Node::Region { region, children } => {
                    if matches!(region.kind, RegionKind::Ignore { .. }) {
                        continue;
                    }
                    let (parent, input_parent) = match &region.kind {
                        RegionKind::Instance { path, key, .. } => {
                            let index = result.instances.len();
                            keys.insert(key.clone(), index);
                            result.instances.push(Instance {
                                path: mapped(path, paths),
                                key: key.clone(),
                                parent,
                                input_parent,
                            });
                            (Some(index), Some(index))
                        }
                        RegionKind::Slot { owner, .. } => {
                            let input_parent = match owner {
                                ComponentInputOwner::Entry => None,
                                ComponentInputOwner::Instance { instance_key } => {
                                    keys.get(instance_key).copied()
                                }
                            };
                            (parent, input_parent)
                        }
                        _ => (parent, input_parent),
                    };
                    pending.extend(
                        children
                            .iter()
                            .rev()
                            .map(|node| (node, parent, input_parent)),
                    );
                }
                Node::Element(element) => {
                    result.elements.push((parent, input_parent));
                    if element.name != "template" {
                        pending.extend(
                            element
                                .children
                                .iter()
                                .rev()
                                .map(|node| (node, parent, input_parent)),
                        );
                    }
                }
                _ => {}
            }
        }
        result
    }
}
