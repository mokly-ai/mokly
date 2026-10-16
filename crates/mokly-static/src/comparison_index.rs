//! Project proven Changes onto public records without exposing private catalogue fields.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::{ComparisonResult, EntryClassification};
use mokly_graph::types::RenderGeneration;
use mokly_model::axes::EntryKind;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::{
    CatalogueChanges, CatalogueEntry, ChangeKind, ChangesStatus, ComparisonSelection,
};
use mokly_model::public_records::{CatalogueRecord, CatalogueVisual};
use mokly_model::review::ReviewState;

use crate::error::{InternalError, Result};

pub(crate) fn kind(state: ReviewState) -> ChangeKind {
    match state {
        ReviewState::Added => ChangeKind::Added,
        ReviewState::Removed => ChangeKind::Removed,
        ReviewState::Changed => ChangeKind::Changed,
        ReviewState::Unchanged | ReviewState::IgnoredOnly => ChangeKind::Unmodified,
    }
}

pub(crate) fn eligible(entry: &EntryClassification) -> bool {
    entry.documents.iter().any(|view| {
        view.before_route.is_some()
            && matches!(view.state, ReviewState::Changed | ReviewState::Removed)
    }) && matches!(entry.kind, EntryKind::Component | EntryKind::Screen)
        && !(entry.kind == EntryKind::Screen && entry.state == ReviewState::Removed)
}

pub(crate) fn apply(index: &mut CatalogueReadModel, result: &ComparisonResult) {
    let entries: BTreeMap<_, _> = result
        .entries
        .iter()
        .map(|entry| ((entry.kind, entry.path.as_str()), entry))
        .collect();
    for entry in &mut index.screens {
        if let Some(change) = entries
            .get(&(EntryKind::Screen, entry.entry.path.as_str()))
            .copied()
        {
            metadata(&mut entry.entry, change);
            visual(&mut entry.visual, change);
        }
    }
    for entry in &mut index.components {
        if let Some(change) = entries
            .get(&(EntryKind::Component, entry.entry.path.as_str()))
            .copied()
        {
            metadata(&mut entry.entry, change);
            visual(&mut entry.visual, change);
            entry.comparison = ComparisonSelection::Ready {
                kind: kind(change.state),
                eligible: eligible(change),
            };
        }
    }
    for (kind, metadata) in index
        .pages
        .iter_mut()
        .map(|entry| (EntryKind::Page, &mut entry.entry))
        .chain(
            index
                .documents
                .iter_mut()
                .map(|entry| (EntryKind::Document, &mut entry.entry)),
        )
        .chain(
            index
                .use_cases
                .iter_mut()
                .map(|entry| (EntryKind::UseCase, &mut entry.entry)),
        )
    {
        if let Some(change) = entries.get(&(kind, metadata.path.as_str())) {
            self::metadata(metadata, change);
        }
    }
}

fn metadata(entry: &mut CatalogueEntry, change: &EntryClassification) {
    entry.previous_path = change.previous_path.clone();
    let entry_kind = if change.included
        && !change.reasons.is_empty()
        && matches!(
            change.state,
            ReviewState::Unchanged | ReviewState::IgnoredOnly
        ) {
        ChangeKind::Changed
    } else {
        kind(change.state)
    };
    entry.changes = CatalogueChanges::Ready {
        kind: entry_kind,
        included: change.included,
    };
}

fn visual(visual: &mut CatalogueVisual, change: &EntryClassification) {
    for view in &mut visual.views {
        if let Some(document) = change.documents.iter().find(|document| {
            document.key.viewport == Some(view.viewport)
                && document.key.color_scheme == view.color_scheme
        }) {
            view.comparison = ComparisonSelection::Ready {
                kind: kind(document.state),
                eligible: eligible(change)
                    && document.before_route.is_some()
                    && matches!(document.state, ReviewState::Changed | ReviewState::Removed),
            };
        }
    }
}

pub(crate) fn base_index(
    result: &ComparisonResult,
    state: &Publication,
) -> Result<CatalogueReadModel> {
    let mut index = match projection::index(
        &result.before.catalogue().model,
        &keys(result.before.as_ref()),
        state,
    ) {
        Ok(index) => index,
        Err(source) => return Err(InternalError::Model { source }.into()),
    };
    apply(&mut index, result);
    Ok(index)
}

pub(crate) fn keys(generation: &dyn RenderGeneration) -> Vec<ViewKey> {
    generation
        .plans()
        .values()
        .filter_map(|plan| {
            Some(ViewKey {
                path: generation
                    .catalogue()
                    .model
                    .entries
                    .get(plan.entry)?
                    .metadata
                    .path
                    .clone(),
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
                key: plan.key.0.clone(),
            })
        })
        .collect()
}

pub(crate) fn records(index: CatalogueReadModel) -> BTreeMap<String, CatalogueRecord> {
    index
        .screens
        .into_iter()
        .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Screen(entry)))
        .chain(
            index
                .components
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Component(entry))),
        )
        .chain(
            index
                .pages
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Page(entry))),
        )
        .chain(
            index
                .documents
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Document(entry))),
        )
        .collect()
}

pub(crate) fn publication(config_path: String, base: &str) -> Publication {
    Publication {
        config_path,
        deployment_id: "0".repeat(64),
        revision: 0,
        base: Some(base.into()),
        changes_status: ChangesStatus::Ready,
        live_generation: None,
    }
}
