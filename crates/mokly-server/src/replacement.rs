//! Source replacements retain proven usage and share identical encoded payloads.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::namespace::viewer;
use mokly_model::projection_usage;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::routes;
use mokly_model::usage::CatalogueUsage;

use crate::detail_encoding::DetailEncoder;
use crate::detail_publication::{PublicationKind, RecentDetails, equivalent};
use crate::error::Result;
use crate::evidence::Completion;
use crate::revision_file::RevisionFile;
use crate::snapshot::Snapshot;

/// Copy the ready usage of each view of `previous` whose document key is unchanged, then
/// settle every workspace when all views have ready usage.
pub(crate) fn reuse_usage(
    details: &mut BTreeMap<String, EntryDetailV4>,
    index: &CatalogueReadModel,
    keys: &BTreeMap<String, String>,
    previous: Option<&Snapshot>,
) -> BTreeMap<String, Completion> {
    let Some(previous) = previous else {
        return BTreeMap::new();
    };
    if previous.index.identity != index.identity
        || previous.index.deployment_id != index.deployment_id
    {
        return BTreeMap::new();
    }
    let completed = copy_usage(details, keys, previous);
    let refs = details
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    for (path, workspace) in projection_usage::workspaces(&refs, index) {
        if let Some(detail) = details.get_mut(&path) {
            detail.workspace = Some(workspace);
        }
    }
    completed
}

/// Copy the ready usage of each view of `previous` whose document key in `keys` is equal,
/// and return each copied view as a ready completion. The workspaces stay unchanged.
pub(crate) fn copy_usage(
    details: &mut BTreeMap<String, EntryDetailV4>,
    keys: &BTreeMap<String, String>,
    previous: &Snapshot,
) -> BTreeMap<String, Completion> {
    let mut completed = BTreeMap::new();
    for (path, detail) in details.iter_mut() {
        let Some(old) = previous.details.get(path) else {
            continue;
        };
        for view in &mut detail.views {
            let route = routes::view(path, view.viewport, view.color_scheme);
            let Some(key) = keys.get(&route) else {
                continue;
            };
            if Some(key) != previous.document_keys.get(&route) {
                continue;
            }
            if let Some(old) = old
                .views
                .iter()
                .find(|old| old.viewport == view.viewport && old.color_scheme == view.color_scheme)
                && matches!(old.usage, CatalogueUsage::Ready { .. })
            {
                view.usage = old.usage.clone();
                completed.insert(route, Completion::Ready);
            }
        }
    }
    completed
}

pub(crate) fn encode_details(
    details: BTreeMap<String, EntryDetailV4>,
    index: &mut CatalogueReadModel,
    previous: Option<&Snapshot>,
    recent: &mut RecentDetails,
    files: &mut BTreeMap<String, RevisionFile>,
    encoder: &dyn DetailEncoder,
) -> Result<BTreeMap<String, Arc<EntryDetailV4>>> {
    let mut result = BTreeMap::new();
    recent.retain_paths(&details);
    for (path, mut detail) in details {
        let route = viewer(&format!("entries/{path}.json"));
        let adjacent = previous
            .and_then(|previous| previous.details.get(&path).zip(previous.files.get(&route)));
        detail.revision = adjacent
            .filter(|(old, _)| equivalent(&detail, old))
            .map_or(Some(index.revision), |(old, _)| old.revision);
        let mut detail = Arc::new(detail);
        let kind = PublicationKind::rebuild(&detail);
        let file = recent.publish(kind, &mut detail, adjacent, encoder)?;
        mokly_model::projection::set_detail_id(index, &path, &detail.detail_id);
        files.insert(route, file);
        result.insert(path, detail);
    }
    Ok(result)
}
