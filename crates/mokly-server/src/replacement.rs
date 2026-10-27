//! Source replacements retain proven usage and share identical encoded payloads.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::canonical;
use mokly_model::namespace::viewer;
use mokly_model::projection_usage;
use mokly_model::public_detail::EntryDetailV3;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::routes;
use mokly_model::usage::CatalogueUsage;
use mokly_model::usage_schemas::UsageSchemas;

use crate::detail_encoding::DetailEncoder;
use crate::error::Result;
use crate::evidence::Completion;
use crate::revision_file::RevisionFile;
use crate::snapshot::Snapshot;

pub(crate) fn reuse_usage(
    details: &mut BTreeMap<String, EntryDetailV3>,
    index: &CatalogueReadModel,
    keys: &BTreeMap<String, String>,
    previous: Option<&Snapshot>,
) -> BTreeMap<String, Completion> {
    let mut completed = BTreeMap::new();
    let Some(previous) = previous else {
        return completed;
    };
    if previous.index.identity != index.identity
        || previous.index.deployment_id != index.deployment_id
    {
        return completed;
    }
    for (path, detail) in details.iter_mut() {
        let Some(old) = previous.details.get(path) else {
            continue;
        };
        for view in &mut detail.views {
            let route = routes::view(path, view.viewport, view.color_scheme);
            if keys.get(&route) != previous.document_keys.get(&route) {
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

pub(crate) fn encode_details(
    mut details: BTreeMap<String, EntryDetailV3>,
    index: &mut CatalogueReadModel,
    previous: Option<&Snapshot>,
    files: &mut BTreeMap<String, RevisionFile>,
    encoder: &dyn DetailEncoder,
) -> Result<BTreeMap<String, Arc<EntryDetailV3>>> {
    let mut result = BTreeMap::new();
    for (path, detail) in details.iter_mut() {
        let detail_id = canonical::detail_id(detail)
            .map_err(|source| crate::error::InternalError::Model { source })?;
        if let Some(previous) = previous
            && let Some(old) = previous.details.get(path)
        {
            let old_id = canonical::detail_id(old.as_ref())
                .map_err(|source| crate::error::InternalError::Model { source })?;
            if detail_id == old_id {
                detail.revision = old.revision;
                detail.detail_id = old.detail_id.clone();
            } else {
                detail.revision = Some(index.revision);
                detail.detail_id = detail_id;
            }
        } else {
            detail.revision = Some(index.revision);
            detail.detail_id = detail_id;
        }
        mokly_model::projection::set_detail_id(index, path, &detail.detail_id);
    }
    let mut schemas = UsageSchemas::new(&index.components);
    for (path, mut detail) in details {
        let route = viewer(&format!("entries/{path}.json"));
        if let Some(previous) = previous
            && let (Some(old), Some(bytes)) =
                (previous.details.get(&path), previous.files.get(&route))
            && detail == **old
        {
            files.insert(route, bytes.clone());
            result.insert(path, old.clone());
            continue;
        }
        detail.revision = Some(index.revision);
        files.insert(route, encoder.encode(&detail, index, &mut schemas)?);
        result.insert(path, Arc::new(detail));
    }
    Ok(result)
}
