//! Paired canonical equality and caller-owned instance input signals.

use std::collections::{BTreeMap, BTreeSet};

use mokly_html::composition::Composed;
use mokly_html::tree::{self, Node, RegionKind};
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use crate::material::{self, Projection};
use crate::{instance_impact, instance_inputs};

pub(crate) struct MaterialComparison {
    pub(crate) changed: bool,
    pub(crate) ignored_only: bool,
    pub(crate) ignored_ids: Vec<String>,
    pub(crate) inputs: bool,
    pub(crate) structure: bool,
    pub(crate) root_changed: bool,
    pub(crate) instances: Vec<instance_impact::PairedInstance>,
}

pub(crate) fn compare(
    before: &Composed,
    after: &Composed,
    before_route: &str,
    after_route: &str,
    paths: &BTreeMap<String, String>,
    resources: &BTreeMap<String, String>,
) -> MaterialComparison {
    let (mut left, mut right) =
        projections(before, after, before_route, after_route, paths, resources);
    let changed =
        material::canonical(&before.tree, &left) != material::canonical(&after.tree, &right);
    let root_changed = material::canonical(root(&before.tree).unwrap_or_default(), &left)
        != material::canonical(root(&after.tree).unwrap_or_default(), &right);
    let instances = instance_impact::collect(&before.tree, &after.tree, &left, &right);
    let ignored_ids = left.ignored.iter().cloned().collect();
    left.ignored.clear();
    right.ignored.clear();
    let ignored_only = !changed
        && material::canonical(&before.tree, &left) != material::canonical(&after.tree, &right);
    let (inputs, structure) = input_signals(&before.usage, &after.usage, paths);
    MaterialComparison {
        changed,
        ignored_only,
        ignored_ids,
        inputs,
        structure,
        root_changed,
        instances,
    }
}

pub(crate) fn projections(
    before: &Composed,
    after: &Composed,
    before_route: &str,
    after_route: &str,
    paths: &BTreeMap<String, String>,
    resources: &BTreeMap<String, String>,
) -> (Projection, Projection) {
    let ignored_before = material::ignores(&before.tree);
    let ignored_after = material::ignores(&after.tree);
    let ignored: BTreeSet<_> = ignored_before
        .intersection(&ignored_after)
        .cloned()
        .collect();
    let before_instances = material::instances(&before.tree, paths);
    let after_instances = material::instances(&after.tree, &BTreeMap::new());
    let instances = before_instances
        .iter()
        .filter(|(key, path)| after_instances.get(*key) == Some(*path))
        .map(|(key, _)| key.clone())
        .collect();
    let left = Projection {
        ignored: ignored.clone(),
        instances,
        paths: paths.clone(),
        resources: resources.clone(),
        route: before_route.into(),
        instance_owner: None,
        inputs: instance_inputs::collect(&before.usage),
    };
    let right = Projection {
        ignored,
        instances: left.instances.clone(),
        route: after_route.into(),
        inputs: instance_inputs::collect(&after.usage),
        ..Default::default()
    };
    (left, right)
}

fn input_signals(
    before: &CatalogueUsage,
    after: &CatalogueUsage,
    paths: &BTreeMap<String, String>,
) -> (bool, bool) {
    let before_usage = before;
    let after_usage = after;
    let (
        CatalogueUsage::Ready {
            instances: before, ..
        },
        CatalogueUsage::Ready {
            instances: after, ..
        },
    ) = (before, after)
    else {
        return (true, true);
    };
    let before: BTreeMap<_, _> = before
        .iter()
        .filter(|instance| matches!(instance.owner, ComponentInputOwner::Entry))
        .map(|instance| (&instance.key, instance))
        .collect();
    let after: BTreeMap<_, _> = after
        .iter()
        .filter(|instance| matches!(instance.owner, ComponentInputOwner::Entry))
        .map(|instance| (&instance.key, instance))
        .collect();
    let inputs = before.iter().any(|(key, instance)| {
        after
            .get(key)
            .is_some_and(|other| instance.props_key != other.props_key)
    });
    let before_slots = instance_inputs::collect(before_usage);
    let after_slots = instance_inputs::collect(after_usage);
    let structure = before.len() != after.len()
        || before.iter().any(|(key, instance)| {
            after.get(key).is_none_or(|other| {
                before_slots.get(*key) != after_slots.get(*key)
                    || instance.order != other.order
                    || instance.id != other.id
                    || material::mapped(&instance.component_id, paths) != other.component_id
            })
        });
    (inputs, structure)
}

pub(crate) fn root(nodes: &[Node]) -> Option<&[Node]> {
    tree::walk(nodes).find_map(|node| match node {
        Node::Region { region, children } if matches!(region.kind, RegionKind::Root { .. }) => {
            Some(children.as_slice())
        }
        _ => None,
    })
}
