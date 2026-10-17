//! Historical public records and details use only the accepted base generation.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_graph::types::RenderGeneration;
use mokly_model::axes::EntryKind;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_index::{CatalogueReadModel, RemovedEntry, RemovedPreview};
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::public_records::CatalogueRecord;
use mokly_model::snapshot::RemovedPagePreview;
use mokly_model::usage::CatalogueUsage;

use crate::assets::File;
use crate::changes::Accepted;
use crate::changes_index;
use crate::error::{InternalError, Result, ServerError};
use crate::snapshot::{Snapshot, encode};

fn base(
    result: &ComparisonResult,
    current: &CatalogueReadModel,
) -> Result<(CatalogueReadModel, Vec<ViewKey>)> {
    let graph = &result.before;
    let keys = keys(graph.as_ref());
    let mut index = match projection::index(
        &graph.catalogue().model,
        &keys,
        &Publication {
            config_path: String::new(),
            deployment_id: current.deployment_id.clone(),
            revision: current.revision,
            base: current.base.clone(),
            changes_status: ChangesStatus::Pending,
            live_generation: None,
        },
    ) {
        Ok(index) => index,
        Err(source) => return Err(InternalError::Model { source }.into()),
    };
    index.identity = current.identity.clone();
    Ok((index, keys))
}

pub(crate) fn keys(graph: &dyn RenderGeneration) -> Vec<ViewKey> {
    graph
        .plans()
        .values()
        .map(|plan| ViewKey {
            path: graph.catalogue().model.entries[plan.entry]
                .metadata
                .path
                .clone(),
            viewport: plan.viewport,
            color_scheme: plan.color_scheme,
            key: plan.key.0.clone(),
        })
        .collect()
}

pub(crate) fn records(
    result: &ComparisonResult,
    current: &CatalogueReadModel,
) -> Result<Vec<RemovedEntry>> {
    let (base, _) = base(result, current)?;
    let mut records: BTreeMap<_, _> = base
        .screens
        .into_iter()
        .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Screen(entry)))
        .chain(
            base.components
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Component(entry))),
        )
        .chain(
            base.pages
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Page(entry))),
        )
        .chain(
            base.documents
                .into_iter()
                .map(|entry| (entry.entry.path.clone(), CatalogueRecord::Document(entry))),
        )
        .collect();
    let classifications: BTreeMap<_, _> = result
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    let mut removed = Vec::new();
    for historical in &result.snapshot.removed_entries {
        let path = &historical.entry.metadata().path;
        let mut record = records.remove(path).ok_or(ServerError::InvalidAssets)?;
        let classification = classifications.get(path.as_str()).copied();
        let metadata = match &mut record {
            CatalogueRecord::Screen(entry) => {
                changes_index::visual(&mut entry.visual, ChangesStatus::Ready, classification);
                &mut entry.entry
            }
            CatalogueRecord::Component(entry) => {
                changes_index::visual(&mut entry.visual, ChangesStatus::Ready, classification);
                entry.comparison = mokly_model::public_metadata::ComparisonSelection::Ready {
                    kind: mokly_model::public_metadata::ChangeKind::Removed,
                    eligible: true,
                };
                &mut entry.entry
            }
            CatalogueRecord::Page(entry) => &mut entry.entry,
            CatalogueRecord::Document(entry) => &mut entry.entry,
            CatalogueRecord::UseCase(entry) => &mut entry.entry,
        };
        changes_index::common(metadata, ChangesStatus::Ready, classification);
        removed.push(RemovedEntry {
            entry: record,
            folder_titles: historical.folder_titles.clone(),
            parent_title: historical.parent_title.clone(),
            snapshot_id: Some(historical.snapshot_id.clone()),
            preview: match historical.entry.kind() {
                EntryKind::Screen => Some(RemovedPreview::Screen),
                EntryKind::Page => Some(RemovedPreview::Page),
                EntryKind::Document => Some(RemovedPreview::Document),
                _ => None,
            },
        });
    }
    Ok(removed)
}

pub(crate) fn files(accepted: &Accepted, current: &Snapshot) -> Result<BTreeMap<String, File>> {
    let result = &accepted.result;
    let (base, keys) = base(result, &current.index)?;
    let mut details = projection::pending_details(&result.before.catalogue().model, &base, &keys);
    let mut files = BTreeMap::from([("review.json".into(), encode(&result.review)?)]);
    for historical in &result.snapshot.removed_entries {
        let path = &historical.entry.metadata().path;
        let mut detail = details.remove(path).ok_or(ServerError::InvalidAssets)?;
        detail.deployment_id = None;
        detail.revision = None;
        detail.generation = Some(accepted.id.clone());
        detail.entry.snapshot_id = Some(historical.snapshot_id.clone());
        let classification = result
            .entries
            .iter()
            .find(|entry| &entry.path == path)
            .ok_or(ServerError::InvalidAssets)?;
        for view in &mut detail.views {
            let document = classification
                .documents
                .iter()
                .find(|document| {
                    document.key.viewport == Some(view.viewport)
                        && document.key.color_scheme == view.color_scheme
                })
                .ok_or(ServerError::InvalidAssets)?;
            view.resource_evidence = Some(document.evidence.clone());
            let route = document
                .before_route
                .as_deref()
                .ok_or(ServerError::InvalidAssets)?;
            let artifact = match result.before.render(route) {
                Ok(artifact) => artifact,
                Err(source) => return Err(ServerError::Render { source }),
            };
            view.usage = artifact
                .document
                .as_ref()
                .map_or(CatalogueUsage::Unavailable, |document| {
                    document.usage.clone()
                });
        }
        if detail.entry.kind == EntryKind::Page {
            detail.resource_evidence = classification
                .documents
                .first()
                .map(|document| document.evidence.clone());
        }
        files.insert(format!("entries/{path}.json"), encode(&detail)?);
        if matches!(detail.entry.kind, EntryKind::Page | EntryKind::Document) {
            files.insert(
                format!("previews/{path}/index.json"),
                encode(&RemovedPagePreview {
                    schema_version: 3,
                    path: path.clone(),
                    base_ref: result.snapshot.base_ref.clone(),
                    base_commit: result.snapshot.base_commit.clone(),
                })?,
            );
        }
    }
    Ok(files)
}
