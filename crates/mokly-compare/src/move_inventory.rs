//! Per-entry view and variant inventories reused by move evidence.

use std::collections::BTreeMap;

use mokly_graph::types::{DocumentPlan, RenderGeneration};
use mokly_model::catalogue::CatalogueModel;

use crate::comparison_types::ViewKey;

pub(crate) type PlanIndex<'a> = BTreeMap<usize, BTreeMap<ViewKey, &'a DocumentPlan>>;

pub(crate) fn index(generation: &dyn RenderGeneration) -> PlanIndex<'_> {
    let mut entries: PlanIndex<'_> = BTreeMap::new();
    for plan in generation.plans().values() {
        entries.entry(plan.entry).or_default().insert(
            ViewKey {
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
            },
            plan,
        );
    }
    entries
}

pub(crate) type VariantIndex = BTreeMap<String, BTreeMap<String, usize>>;

pub(crate) fn variant_index(model: &CatalogueModel) -> VariantIndex {
    let mut entries = VariantIndex::new();
    for (index, entry) in model.entries.iter().enumerate() {
        if let Some(parent) = &entry.metadata.variant_of {
            let slug = entry
                .metadata
                .path
                .rsplit('/')
                .next()
                .unwrap_or("")
                .to_ascii_lowercase();
            entries
                .entry(parent.to_ascii_lowercase())
                .or_default()
                .insert(slug, index);
        }
    }
    entries
}
