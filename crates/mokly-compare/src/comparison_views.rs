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
use crate::instance_policy;
use crate::instance_proof::InstanceProof;
use crate::move_inventory::PlanIndex;
use crate::move_types::Pairing;
use crate::owned_styles;
use crate::resource_memo::ResourceMemo;
use crate::reuse_collection::Collection;
use crate::reuse_digest;

pub(crate) struct UsageView {
    pub(crate) side: ReviewSide,
    pub(crate) entry: ReviewEntryAddress,
    pub(crate) component: bool,
    pub(crate) key: ViewKey,
    pub(crate) usage: CatalogueUsage,
}

pub(crate) struct PendingView {
    pub(crate) input: Arc<ImmutableView>,
    pub(crate) document: DocumentComparison,
    pub(crate) rule_sources: BTreeSet<String>,
}

/// Reducers read immutable evidence and write separate classification output.
pub(crate) struct ImmutableView {
    pub(crate) document: DocumentComparison,
    pub(crate) observation: PageObservation,
    pub(crate) material: bool,
    pub(crate) inputs: bool,
    pub(crate) structure: bool,
    pub(crate) root_changed: bool,
    pub(crate) proofs: Vec<InstanceProof>,
    pub(crate) owned: owned_styles::Changes,
}

impl PendingView {
    pub(crate) fn new(input: Arc<ImmutableView>) -> Self {
        Self {
            document: input.document.clone(),
            input,
            rule_sources: BTreeSet::new(),
        }
    }
}

#[derive(Default)]
pub(crate) struct PairViews {
    pub(crate) warnings: Vec<Warning>,
    pub(crate) views: Vec<PendingView>,
    pub(crate) usage: Vec<UsageView>,
}

/// Keep entry outputs and every memo call in pairing and view order.
pub(crate) fn collect(
    pairing: &Pairing,
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
    paths: &BTreeMap<String, String>,
    memo: &dyn ResourceMemo,
    plans: [&PlanIndex<'_>; 2],
    mut reuse: Option<&mut Collection>,
) -> Result<Vec<PairViews>> {
    let pairs = &pairing.entries;
    let paths_preserved =
        pairing.preserves_document_paths(&before.catalogue().model, &after.catalogue().model);
    let mut results: Vec<_> = pairs.iter().map(|_| PairViews::default()).collect();
    let mut routes = comparison_routes::stream(pairs, plans[0], plans[1]).peekable();
    if routes.peek().is_none() {
        return Ok(results);
    }
    before.check_cancelled().compare()?;
    after.check_cancelled().compare()?;
    let probes = reuse.as_ref().map(|reuse| reuse.probes.clone());
    let recording = reuse.as_ref().map(|reuse| reuse.recording.clone());
    let transparent = [before.catalogue(), after.catalogue()].map(instance_policy::transparent);
    if let Some(reuse) = &mut reuse {
        reuse.projection = reuse_digest::digest(&(paths, transparent.each_ref().map(Arc::as_ref)));
    }
    let preparation: &dyn ViewPreparation = &Preparation {
        probes: probes.as_ref(),
        recording: recording.as_deref(),
        before: before.as_ref(),
        after: after.as_ref(),
        paths,
        transparent: &transparent,
        paths_preserved,
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
                transparent: &transparent,
                memo,
            }
        })
        .collect();
    let slots = Slots::new(
        preparation,
        before.as_ref(),
        after.as_ref(),
        before.comparison_parallelism().max(1).saturating_mul(2),
        probes.as_deref(),
    );
    let (outcome, admitted_views) = {
        let mut stream = ViewStream {
            reuse,
            routes: Box::new(routes),
            slots: &slots,
            preparation,
            before: before.as_ref(),
            after: after.as_ref(),
            consumers: &consumers,
            results: &mut results,
            outcome: Ok(()),
            admitted_views: 0,
        };
        before.schedule_comparison_stream(&slots, &mut stream);
        (stream.outcome, stream.admitted_views)
    };
    tracing::Span::current().record("admitted_views", admitted_views as u64);
    outcome?;
    Ok(results)
}
