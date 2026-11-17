//! Render each paired view once and retain only classification and ownership evidence.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_css::attribution::PageObservation;
use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::EntryContent;
use mokly_model::review::ReviewEntryAddress;
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;

use crate::comparison_consumer::Consumer;
use crate::comparison_error::CompareResult;
use crate::comparison_pipeline::ViewStream;
use crate::comparison_preparation::{Preparation, ViewPreparation};
use crate::comparison_routes;
use crate::comparison_slots::Slots;
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

#[derive(Default)]
pub(crate) struct PairViews {
    pub(crate) warnings: Vec<Warning>,
    pub(crate) views: Vec<PendingView>,
    pub(crate) usage: Vec<UsageView>,
}

/// Keep entry outputs and every memo call in pairing and view order.
pub(crate) fn collect(
    pairs: &[EntryPair],
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
    paths: &BTreeMap<String, String>,
    memo: &dyn ResourceMemo,
    before_plans: &PlanIndex<'_>,
    after_plans: &PlanIndex<'_>,
) -> Result<Vec<PairViews>> {
    let mut results: Vec<_> = pairs.iter().map(|_| PairViews::default()).collect();
    let mut routes = comparison_routes::stream(pairs, before_plans, after_plans).peekable();
    if routes.peek().is_none() {
        return Ok(results);
    }
    before.check_cancelled().compare()?;
    after.check_cancelled().compare()?;
    let preparation: &dyn ViewPreparation = &Preparation {
        before: before.as_ref(),
        after: after.as_ref(),
        paths,
    };
    let consumers: Vec<_> = pairs
        .iter()
        .map(|pair| {
            let current = pair
                .after
                .map(|index| &after.catalogue().model.entries[index]);
            let previous = pair
                .before
                .map(|index| &before.catalogue().model.entries[index]);
            let component = current.or(previous).and_then(|entry| {
                matches!(entry.content, EntryContent::Component { .. }).then(|| {
                    entry
                        .metadata
                        .variant_of
                        .clone()
                        .unwrap_or_else(|| entry.metadata.path.clone())
                })
            });
            Consumer {
                moved: pair.moved,
                previous,
                current,
                component,
                paths,
                memo,
            }
        })
        .collect();
    let slots = Slots::new(
        preparation,
        before.as_ref(),
        after.as_ref(),
        before.comparison_parallelism().max(1).saturating_mul(2),
    );
    let outcome = {
        let mut stream = ViewStream {
            routes: Box::new(routes),
            slots: &slots,
            preparation,
            before: before.as_ref(),
            after: after.as_ref(),
            consumers: &consumers,
            results: &mut results,
            outcome: Ok(()),
        };
        before.schedule_comparison_stream(&slots, &mut stream);
        stream.outcome
    };
    outcome?;
    Ok(results)
}
