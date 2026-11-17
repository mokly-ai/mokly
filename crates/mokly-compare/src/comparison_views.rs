//! Render each paired view once and retain only classification and ownership evidence.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_css::attribution::PageObservation;
use mokly_graph::comparison_input::RetainedComparisonInput;
use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::EntryContent;
use mokly_model::review::ReviewEntryAddress;
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;

use crate::comparison_batch::{Batch, ViewRoutes};
use crate::comparison_consumer::{Consumer, ViewConsumer};
use crate::comparison_error::CompareResult;
use crate::comparison_preparation::{Preparation, ViewInput, ViewPreparation};
use crate::comparison_types::{DocumentComparison, ViewKey};
use crate::error::Result;
use crate::instance_proof::InstanceProof;
use crate::move_inventory::PlanIndex;
use crate::move_types::EntryPair;
use crate::owned_styles;
use crate::resource_memo::ResourceMemo;

pub(crate) struct UsageView {
    pub(crate) side: ReviewSide,
    pub(crate) entry: ReviewEntryAddress,
    pub(crate) component: bool,
    pub(crate) key: ViewKey,
    pub(crate) usage: CatalogueUsage,
}

pub(crate) struct PendingView {
    pub(crate) document: DocumentComparison,
    pub(crate) observation: PageObservation,
    pub(crate) material: bool,
    pub(crate) inputs: bool,
    pub(crate) structure: bool,
    pub(crate) root_changed: bool,
    /// Direct CSS dependency sources proved by own-root matches or entry evidence.
    pub(crate) rule_sources: BTreeSet<String>,
    pub(crate) proofs: Vec<InstanceProof>,
    pub(crate) owned: owned_styles::Changes,
}

pub(crate) struct PairViews {
    pub(crate) warnings: Vec<Warning>,
    pub(crate) views: Vec<PendingView>,
    pub(crate) usage: Vec<UsageView>,
}

/// Reads both sides of each view through the render generation and its cache,
/// never a snapshot, so Serve's background classification and a complete
/// comparison record the same state and evidence for one view.
pub(crate) fn collect(
    pair: &EntryPair,
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
    paths: &BTreeMap<String, String>,
    memo: &dyn ResourceMemo,
    before_plans: &PlanIndex<'_>,
    after_plans: &PlanIndex<'_>,
) -> Result<PairViews> {
    let left = pair
        .before
        .and_then(|index| before_plans.get(&index).cloned())
        .unwrap_or_default();
    let right = pair
        .after
        .and_then(|index| after_plans.get(&index).cloned())
        .unwrap_or_default();
    let keys: BTreeSet<_> = left.keys().chain(right.keys()).copied().collect();
    let current = pair
        .after
        .map(|index| &after.catalogue().model.entries[index]);
    let previous = pair
        .before
        .map(|index| &before.catalogue().model.entries[index]);
    let entry = current.or(previous);
    let component = entry.and_then(|entry| {
        matches!(entry.content, EntryContent::Component { .. }).then(|| {
            entry
                .metadata
                .variant_of
                .clone()
                .unwrap_or_else(|| entry.metadata.path.clone())
        })
    });
    let mut result = PairViews {
        warnings: Vec::new(),
        views: Vec::new(),
        usage: Vec::new(),
    };
    let preparation: &dyn ViewPreparation = &Preparation {
        before: before.as_ref(),
        after: after.as_ref(),
        paths,
    };
    let consumer: &dyn ViewConsumer = &Consumer {
        moved: pair.moved,
        previous,
        current,
        component,
        paths,
        memo,
    };
    let mut keys = keys.into_iter();
    loop {
        let routes: Vec<_> = keys
            .by_ref()
            .take(before.comparison_parallelism().max(1))
            .map(|key| ViewRoutes {
                key,
                before: left.get(&key).map(|plan| plan.route.clone()),
                after: right.get(&key).map(|plan| plan.route.clone()),
            })
            .collect();
        if routes.is_empty() {
            break;
        }
        before.check_cancelled().compare()?;
        after.check_cancelled().compare()?;
        let batch = Batch::new(
            preparation,
            &routes,
            pair.moved,
            before.as_ref(),
            after.as_ref(),
        );
        before.schedule_comparison_tasks(routes.len(), &batch);
        for (route, input) in routes.iter().zip(batch.results()) {
            before.check_cancelled().compare()?;
            after.check_cancelled().compare()?;
            let prepared = match input? {
                ViewInput::Ready(prepared) => prepared,
                ViewInput::Deferred(recipe) => Box::new(preparation.prepare(
                    route.before.as_deref(),
                    route.after.as_deref(),
                    pair.moved,
                    recipe.map(RetainedComparisonInput::Deferred),
                )?),
            };
            consumer.consume(
                &mut result,
                route.key,
                route.before.clone(),
                route.after.clone(),
                *prepared,
            )?;
        }
    }

    Ok(result)
}
