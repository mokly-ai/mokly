//! Settled comparison evidence and historical detail identity.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::axes::EntryKind;
use mokly_model::public_detail::EntryDetailV1;
use mokly_model::public_index::CatalogueReadModel;

use crate::comparison_files::graph;
use crate::comparison_workspace;
use crate::error::{Error, Result};

pub(crate) fn current(
    details: &mut BTreeMap<String, EntryDetailV1>,
    index: &CatalogueReadModel,
    result: &ComparisonResult,
) -> Result<()> {
    evidence(details, result);
    comparison_workspace::apply(details, index, result)
}

pub(crate) fn evidence(details: &mut BTreeMap<String, EntryDetailV1>, result: &ComparisonResult) {
    for entry in &result.entries {
        let Some(detail) = details
            .get_mut(&entry.path)
            .filter(|detail| detail.entry.kind == entry.kind)
        else {
            continue;
        };
        for document in &entry.documents {
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == document.key.viewport
                    && view.color_scheme == document.key.color_scheme
            }) {
                view.resource_evidence = Some(document.evidence.clone());
            }
            if entry.kind == EntryKind::Page {
                detail.resource_evidence = Some(document.evidence.clone());
            }
        }
    }
}

pub(crate) fn historical(
    details: &mut BTreeMap<String, EntryDetailV1>,
    result: &ComparisonResult,
) -> Result<()> {
    for removed in &result.snapshot.removed_entries {
        let path = removed.entry.metadata().path.as_str();
        let detail = details
            .get_mut(path)
            .ok_or_else(|| Error::Invalid { path: path.into() })?;
        detail.deployment_id = None;
        detail.revision = None;
        detail.generation = Some("0".repeat(64));
        detail.entry.snapshot_id = Some(removed.snapshot_id.clone());
        for plan in result.before.plans().values().filter(|plan| {
            result.before.catalogue().model.entries[plan.entry]
                .metadata
                .path
                == path
        }) {
            let artifact = graph(result.before.render(&plan.route))?;
            let document = artifact.document.as_ref().ok_or_else(|| Error::Invalid {
                path: plan.route.clone(),
            })?;
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme
            }) {
                view.usage = document.usage.clone();
            }
        }
    }
    evidence(details, result);
    Ok(())
}
