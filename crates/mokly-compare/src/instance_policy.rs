//! Side-specific instance projection from private story recipes.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::tree::{self, Node, RegionKind};

pub(crate) type TransparentComponents = Arc<BTreeSet<String>>;
pub(crate) type Transparency = [TransparentComponents; 2];

pub(crate) fn transparent(catalogue: &PreparedCatalogue) -> TransparentComponents {
    Arc::new(
        catalogue
            .javascript
            .entries
            .iter()
            .filter(|(_, source)| source.content_slots_disabled())
            .map(|(path, _)| path.clone())
            .collect(),
    )
}

pub(crate) fn same_for(nodes: &[Node], [before, after]: &Transparency) -> bool {
    before == after
        || tree::walk(nodes).all(|node| match node {
            Node::Region { region, .. } => match &region.kind {
                RegionKind::Instance { path, .. } => before.contains(path) == after.contains(path),
                _ => true,
            },
            _ => true,
        })
}
