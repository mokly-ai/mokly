//! Project proven Changes onto public records without exposing private catalogue fields.

use std::collections::BTreeMap;

use mokly_graph::types::RenderGeneration;
use mokly_model::axes::EntryKind;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::{
    CatalogueChanges, CatalogueEntry, ChangeKind, ChangesStatus, ComparisonSelection,
};
use mokly_model::public_records::{CatalogueRecord, CatalogueVisual};

use crate::comparison_error::CompareResult;
use crate::comparison_types::{ComparisonResult, EntryClassification};
use crate::error::Result;
use crate::projection_context::Context;

/// Apply retained entry and view classifications to a current or historical index.
/// Keep deployment, revision, and live fences; the caller sets the URL after capture.
/// The index must come from the same retained before or after catalogue state.
/// A current index needs classifications for every published record and view.
/// A base index is intermediate: publish only its classified removed records.
/// Apply before adding removed records; the caller installs those with the generation URL.
pub fn apply(index: &mut CatalogueReadModel, result: &ComparisonResult) {
    index.changes_status = ChangesStatus::Ready;
    index.base = Some(result.snapshot.base_ref.clone());
    let context = Context::new(result);
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
            metadata(&mut entry.entry, change, &context);
            visual(&mut entry.visual, change);
        }
    }
    for entry in &mut index.components {
        if let Some(change) = entries
            .get(&(EntryKind::Component, entry.entry.path.as_str()))
            .copied()
        {
            metadata(&mut entry.entry, change, &context);
            visual(&mut entry.visual, change);
            entry.comparison = ComparisonSelection::Ready {
                kind: context.comparison_kind(change),
                eligible: context.eligible(change),
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
            self::metadata(metadata, change, &context);
        }
    }
}

fn metadata(entry: &mut CatalogueEntry, change: &EntryClassification, context: &Context<'_>) {
    entry.previous_path = change.previous_path.clone();
    entry.changes = CatalogueChanges::Ready {
        kind: context.kind(change),
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
                kind: Context::view_kind(document.state),
                eligible: Context::view_kind(document.state) == ChangeKind::Changed
                    || (change.kind == EntryKind::Component
                        && Context::view_kind(document.state) == ChangeKind::Removed),
            };
        }
    }
}

/// Project the pinned base catalogue, including its selected removed records.
pub fn base_index(result: &ComparisonResult, state: &Publication) -> Result<CatalogueReadModel> {
    let mut index = projection::index(
        &result.before.catalogue().model,
        &keys(result.before.as_ref()),
        state,
    )
    .compare()?;
    apply(&mut index, result);
    Ok(index)
}

/// Read document keys without rendering or retaining any document bytes.
pub fn keys(generation: &dyn RenderGeneration) -> Vec<ViewKey> {
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

/// Index previewable public records by their unique catalogue path.
pub fn records(index: CatalogueReadModel) -> BTreeMap<String, CatalogueRecord> {
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

/// Construct the historical index fence used before the generation hash is fixed.
pub fn publication(config_path: String, base: &str) -> Publication {
    Publication {
        config_path,
        deployment_id: "0".repeat(64),
        revision: 0,
        base: Some(base.into()),
        changes_status: ChangesStatus::Ready,
        live_generation: None,
    }
}
