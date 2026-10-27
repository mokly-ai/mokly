//! Shared removed records, historical details, and preview metadata for publication.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::projection;
use mokly_model::public_detail::{EntryDetailV3, Workspace};
use mokly_model::public_index::{CatalogueReadModel, RemovedEntry, RemovedPreview};
use mokly_model::snapshot::RemovedPagePreview;
use mokly_model::versions;

use crate::comparison_error::CompareResult;
use crate::comparison_types::ComparisonResult;
use crate::error::{Error, Result};
use crate::{projection_detail, projection_index};

/// Select removed records from the matching projected base index in snapshot order.
/// Folder and parent titles and snapshot IDs come from the retained base snapshot.
pub fn records(
    result: &ComparisonResult,
    historical: CatalogueReadModel,
) -> Result<Vec<RemovedEntry>> {
    let mut records = projection_index::records(historical);
    result
        .snapshot
        .removed_entries
        .iter()
        .map(|removed| {
            let path = &removed.entry.metadata().path;
            let entry = records
                .remove(path)
                .ok_or_else(|| Error::RemovedRecord { path: path.clone() })?;
            Ok(RemovedEntry {
                entry,
                folder_titles: removed.folder_titles.clone(),
                parent_title: removed.parent_title.clone(),
                snapshot_id: Some(removed.snapshot_id.clone()),
                preview: match removed.entry.kind() {
                    EntryKind::Screen => Some(RemovedPreview::Screen),
                    EntryKind::Page => Some(RemovedPreview::Page),
                    EntryKind::Document => Some(RemovedPreview::Document),
                    _ => None,
                },
            })
        })
        .collect()
}

/// Build removed details from base plans and render usage, even without classified views.
/// The caller assigns the content id after the detail content is complete.
/// Workspaces stay absent; the caller supplies them only after proving their inputs.
/// A missing planned document or historical entry fails instead of inventing usage.
pub fn details(
    result: &ComparisonResult,
    historical: &CatalogueReadModel,
) -> Result<BTreeMap<String, EntryDetailV3>> {
    let mut details = projection::pending_details(
        &result.before.catalogue().model,
        historical,
        &projection_index::keys(result.before.as_ref()),
    );
    let selected: BTreeSet<_> = result
        .snapshot
        .removed_entries
        .iter()
        .map(|removed| removed.entry.metadata().path.as_str())
        .collect();
    details.retain(|path, _| selected.contains(path.as_str()));
    let mut plans = BTreeMap::<_, Vec<_>>::new();
    for plan in result.before.plans().values() {
        let entry = result
            .before
            .catalogue()
            .model
            .entries
            .get(plan.entry)
            .ok_or_else(|| Error::HistoricalPlanEntry {
                route: plan.route.clone(),
                entry: plan.entry,
            })?;
        plans
            .entry(entry.metadata.path.as_str())
            .or_default()
            .push(plan);
    }
    for removed in &result.snapshot.removed_entries {
        let path = removed.entry.metadata().path.as_str();
        let detail = details
            .get_mut(path)
            .ok_or_else(|| Error::RemovedRecord { path: path.into() })?;
        detail.detail_id.clear();
        detail.revision = None;
        detail.entry.snapshot_id = Some(removed.snapshot_id.clone());
        for plan in plans.get(path).into_iter().flatten() {
            let artifact = result.before.render(&plan.route).compare()?;
            let document = artifact
                .document
                .as_ref()
                .ok_or_else(|| Error::HistoricalDocument {
                    route: plan.route.clone(),
                })?;
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme
            }) {
                view.usage = document.usage.clone();
            }
        }
    }
    projection_detail::apply_evidence(&mut details, result);
    Ok(details)
}

/// Describe each removed page and document with the shared preview v3 shape.
pub fn previews(result: &ComparisonResult) -> Vec<RemovedPagePreview> {
    result
        .snapshot
        .removed_entries
        .iter()
        .filter(|removed| matches!(removed.entry.kind(), EntryKind::Page | EntryKind::Document))
        .map(|removed| RemovedPagePreview {
            schema_version: versions::REMOVED_PREVIEW,
            base_ref: result.snapshot.base_ref.clone(),
            base_commit: result.snapshot.base_commit.clone(),
            path: removed.entry.metadata().path.clone(),
        })
        .collect()
}

/// Initialize comparison workspaces after historical usage has been proved.
/// Removed screens and component parents and variants share this policy in every host.
pub fn workspaces(details: &mut BTreeMap<String, EntryDetailV3>) {
    for detail in details.values_mut() {
        if matches!(detail.entry.kind, EntryKind::Screen | EntryKind::Component) {
            detail.workspace = Some(Workspace {
                comparison_eligible: false,
                used_by: Vec::new(),
                affected: Vec::new(),
                related_components: Vec::new(),
                input_changes: Vec::new(),
            });
        }
    }
}
