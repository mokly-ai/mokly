//! Equal codec inputs retain ignore ids, conservative usage signals, and instance candidates.

use std::collections::BTreeMap;

use mokly_html::composition::Composed;
use mokly_html::tree::{self, Node, RegionKind};
use mokly_model::usage::CatalogueUsage;

use crate::instance_impact::PairedInstance;
use crate::material;
use crate::view_material::MaterialComparison;

pub(crate) fn compare(document: &Composed) -> MaterialComparison {
    let mut instances = BTreeMap::new();
    for node in tree::walk(&document.tree) {
        if let Node::Region { region, .. } = node
            && let RegionKind::Instance { key, path, .. } = &region.kind
        {
            instances.entry(key).or_insert(path);
        }
    }
    let incomplete = !matches!(document.usage, CatalogueUsage::Ready { .. });
    MaterialComparison {
        changed: false,
        ignored_only: false,
        ignored_ids: material::ignores(&document.tree).into_iter().collect(),
        inputs: incomplete,
        structure: incomplete,
        root_changed: false,
        instances: instances
            .into_iter()
            .map(|(key, component)| PairedInstance {
                key: key.clone(),
                component: component.clone(),
                render_changed: false,
            })
            .collect(),
    }
}
