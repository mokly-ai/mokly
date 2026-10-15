//! One comparison's indexed generations and accepted variant-pair destinations.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use mokly_graph::types::{DocumentPlan, RenderGeneration};
use mokly_model::catalogue::ModelEntry;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_types::ViewKey;
use crate::move_inventory::{self, PlanIndex, VariantIndex};
use crate::resource_memo::ResourceMemo;

pub(crate) struct RenderedMoves<'a> {
    pub(crate) memo: Arc<dyn ResourceMemo>,
    pub(crate) before: Arc<dyn RenderGeneration>,
    pub(crate) after: Arc<dyn RenderGeneration>,
    before_plans: &'a PlanIndex<'a>,
    after_plans: &'a PlanIndex<'a>,
    before_variants: VariantIndex,
    after_variants: VariantIndex,
    destinations: Mutex<(usize, Arc<BTreeSet<String>>)>,
}

impl<'a> RenderedMoves<'a> {
    pub(crate) fn new(
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
        before_plans: &'a PlanIndex<'a>,
        after_plans: &'a PlanIndex<'a>,
        memo: Arc<dyn ResourceMemo>,
    ) -> Self {
        let before_variants = move_inventory::variant_index(&before.catalogue().model);
        let after_variants = move_inventory::variant_index(&after.catalogue().model);
        Self {
            memo,
            before,
            after,
            before_plans,
            after_plans,
            before_variants,
            after_variants,
            destinations: Mutex::new((0, Arc::new(BTreeSet::new()))),
        }
    }

    pub(crate) fn side(&self, side: ReviewSide) -> &dyn RenderGeneration {
        match side {
            ReviewSide::Before => self.before.as_ref(),
            ReviewSide::After => self.after.as_ref(),
        }
    }

    pub(crate) fn plans(&self, side: ReviewSide, entry: usize) -> BTreeMap<ViewKey, &DocumentPlan> {
        match side {
            ReviewSide::Before => self.before_plans,
            ReviewSide::After => self.after_plans,
        }
        .get(&entry)
        .cloned()
        .unwrap_or_default()
    }

    /// Accepted pairs only grow within this private comparison context.
    pub(crate) fn children(
        &self,
        side: ReviewSide,
        parent: &ModelEntry,
        paths: &BTreeMap<String, String>,
    ) -> BTreeMap<String, usize> {
        let destinations = {
            let mut cache = self
                .destinations
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if cache.0 != paths.len() {
                *cache = (
                    paths.len(),
                    Arc::new(
                        paths
                            .values()
                            .map(|path| path.to_ascii_lowercase())
                            .collect(),
                    ),
                );
            }
            cache.1.clone()
        };
        let index = match side {
            ReviewSide::Before => &self.before_variants,
            ReviewSide::After => &self.after_variants,
        };
        let generation = self.side(side);
        index
            .get(&parent.metadata.path.to_ascii_lowercase())
            .into_iter()
            .flatten()
            .filter(|(_, index)| {
                let path = generation.catalogue().model.entries[**index]
                    .metadata
                    .path
                    .to_ascii_lowercase();
                match side {
                    ReviewSide::Before => !paths.contains_key(&path),
                    ReviewSide::After => !destinations.contains(&path),
                }
            })
            .map(|(slug, index)| (slug.clone(), *index))
            .collect()
    }
}
