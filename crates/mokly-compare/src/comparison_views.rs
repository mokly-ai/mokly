//! Render each paired view once and retain only classification and ownership evidence.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_css::attribution::PageObservation;
use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::evidence::ViewEvidence;
use mokly_model::read_contract::ContractViolation;
use mokly_model::readers::ReadError;
use mokly_model::review::{ReviewEntryAddress, ReviewState};
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;
use mokly_model::wire_props;

use crate::comparison_error::CompareResult;
use crate::comparison_resources::{self, ResourceInput};
use crate::comparison_types::{DocumentComparison, ViewKey};
use crate::error::{Error, Result};
use crate::instance_proof::{InstanceProof, ProofInput};
use crate::move_inventory::PlanIndex;
use crate::move_types::EntryPair;
use crate::resource_memo::ResourceMemo;
use crate::{inline_styles, instance_proof, matching_tree, owned_styles, view_material};

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
    pub(crate) proofs: Vec<InstanceProof>,
}

pub(crate) struct PairViews {
    pub(crate) views: Vec<PendingView>,
    pub(crate) usage: Vec<UsageView>,
}

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
        views: Vec::new(),
        usage: Vec::new(),
    };
    for key in keys {
        let before_route = left.get(&key).map(|plan| plan.route.clone());
        let after_route = right.get(&key).map(|plan| plan.route.clone());
        let before_artifact = before_route
            .as_ref()
            .map(|route| before.comparison_document(route).compare())
            .transpose()?;
        let after_artifact = after_route
            .as_ref()
            .map(|route| after.comparison_document(route).compare())
            .transpose()?;
        let before_document = before_artifact
            .as_ref()
            .and_then(|artifact| artifact.document.as_ref());
        let after_document = after_artifact
            .as_ref()
            .and_then(|artifact| artifact.document.as_ref());
        if key.viewport.is_some()
            && before_document
                .into_iter()
                .chain(after_document)
                .any(|document| !matches!(document.usage, CatalogueUsage::Ready { .. }))
        {
            return Err(Error::Review {
                source: ReadError::Contract {
                    boundary: "rendered usage",
                    message: ContractViolation::Review,
                },
            });
        }
        let resources = comparison_resources::closures(
            before.clone(),
            after.clone(),
            before_route.as_deref(),
            after_route.as_deref(),
            pair.moved,
            memo,
        )?;
        let before_tree =
            before_document.map(|document| matching_tree::document(&document.tree, paths));
        let after_tree = after_document
            .map(|document| matching_tree::document(&document.tree, &BTreeMap::new()));
        let mut observation = PageObservation {
            component: component.clone(),
            ..Default::default()
        };
        let aliases = resources.aliases.clone();
        let evidence = comparison_resources::evidence(
            ResourceInput {
                resources: &resources,
                memo,
                before_tree: before_tree.as_ref(),
                after_tree: after_tree.as_ref(),
                paths,
                before_route: &format!(
                    "static/mokly-generated/{}",
                    before_route.as_deref().unwrap_or("")
                ),
                after_route: &format!(
                    "static/mokly-generated/{}",
                    after_route.as_deref().unwrap_or("")
                ),
            },
            &mut observation,
        )?;
        let mut comparison = match (before_document, after_document) {
            (Some(left), Some(right)) => Some(view_material::compare(
                left,
                right,
                &format!(
                    "static/mokly-generated/{}",
                    before_route.as_deref().unwrap_or("")
                ),
                &format!(
                    "static/mokly-generated/{}",
                    after_route.as_deref().unwrap_or("")
                ),
                paths,
                &aliases,
            )),
            _ => None,
        };
        if let Some(comparison) = &mut comparison {
            let changes = owned_styles::compare(
                [
                    before_document.map_or(&[], |document| document.tree.as_slice()),
                    after_document.map_or(&[], |document| document.tree.as_slice()),
                ],
                [before_tree.as_ref(), after_tree.as_ref()],
                paths,
                memo,
            )?;
            owned_styles::apply(comparison, component.as_deref(), &changes);
        }
        let inline = inline_styles::compare(
            before_document.map(|document| document.tree.as_slice()),
            after_document.map(|document| document.tree.as_slice()),
            before_tree.as_ref(),
            after_tree.as_ref(),
            &format!(
                "static/mokly-generated/{}",
                after_route
                    .as_ref()
                    .or(before_route.as_ref())
                    .map_or("", String::as_str)
            ),
            memo,
        )?;
        observation.rules.extend(inline);
        let proofs = match (&comparison, previous, current) {
            (Some(comparison), Some(before), Some(after)) => instance_proof::collect(ProofInput {
                comparison,
                before,
                after,
                view: key,
                resources: &resources,
                evidence: &evidence,
                paths,
            }),
            _ => Vec::new(),
        };
        let state = match &comparison {
            None if before_document.is_none() => ReviewState::Added,
            None => ReviewState::Removed,
            Some(comparison) if comparison.changed => ReviewState::Changed,
            Some(comparison) if comparison.ignored_only => ReviewState::IgnoredOnly,
            _ => ReviewState::Unchanged,
        };
        let ignored_ids = comparison
            .as_ref()
            .map_or_else(Vec::new, |comparison| comparison.ignored_ids.clone());
        result.views.push(PendingView {
            document: DocumentComparison {
                key,
                before_route,
                after_route,
                state,
                ignored_ids,
                evidence: ViewEvidence {
                    rules: Vec::new(),
                    resources: evidence,
                },
            },
            observation,
            material: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.changed),
            inputs: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.inputs),
            structure: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.structure),
            proofs,
            // A view on one side proves a root change only for a one-sided
            // entry; an entry with both sides that gains or loses a view has
            // no paired canonical form for that view.
            root_changed: comparison
                .as_ref()
                .map_or(previous.is_none() || current.is_none(), |comparison| {
                    comparison.root_changed
                }),
        });
        {
            for (side, entry, document) in [
                (ReviewSide::Before, previous, before_document),
                (ReviewSide::After, current, after_document),
            ] {
                if let (Some(entry), Some(document)) = (entry, document) {
                    result.usage.push(UsageView {
                        side,
                        entry: address(entry),
                        component: matches!(entry.content, EntryContent::Component { .. }),
                        key,
                        usage: document.usage.clone(),
                    });
                }
            }
        }
    }
    Ok(result)
}

pub(crate) fn address(entry: &ModelEntry) -> ReviewEntryAddress {
    let props = match &entry.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
            Some(wire_props::encode(&visual.props))
        }
        _ => None,
    };
    let supplied_slots = match &entry.content {
        EntryContent::Component { supplied_slots, .. } => Some(supplied_slots.clone()),
        _ => None,
    };
    ReviewEntryAddress {
        path: entry.metadata.path.clone(),
        title: entry.metadata.title.clone(),
        props,
        supplied_slots,
    }
}
