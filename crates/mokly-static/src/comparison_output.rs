//! Install one immutable comparison generation before the deployment identity is fixed.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_workspace};
use mokly_model::axes::EntryKind;
use mokly_model::canonical;
use mokly_model::material::digest;
use mokly_model::output::artifact::File;
use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV1;
use mokly_model::public_index::{CatalogueReadModel, RemovedEntry, RemovedPreview};
use mokly_model::review_affected::ReviewSide;
use mokly_model::{readers, routes};
use serde::Serialize;

use crate::comparison_files::{checkpoint, compare, side};
use crate::error::{Error, Result};
use crate::inventory::Inventory;
use crate::transaction::Cancellation;
use crate::{comparison_details, identity};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Preview<'a> {
    schema_version: u32,
    base_ref: &'a str,
    base_commit: &'a str,
    path: &'a str,
}

#[tracing::instrument(name = "review.capture", skip_all, err)]
pub(crate) fn append(
    result: &ComparisonResult,
    index: &mut CatalogueReadModel,
    output: &mut Inventory,
    stub: &[u8],
    config_path: &str,
    cancellation: &dyn Cancellation,
) -> Result<()> {
    let state = projection_index::publication(config_path.into(), &result.snapshot.base_ref);
    let historical = compare(projection_index::base_index(result, &state))?;
    let mut details = projection::pending_details(
        &result.before.catalogue().model,
        &historical,
        &projection_index::keys(result.before.as_ref()),
    );
    let mut records = projection_index::records(historical);
    let selected: BTreeMap<_, _> = result
        .snapshot
        .removed_entries
        .iter()
        .map(|entry| (entry.entry.metadata().path.as_str(), entry))
        .collect();
    details.retain(|path, _| selected.contains_key(path.as_str()));
    comparison_details::historical(&mut details, result)?;
    let mut inventory = Inventory::default();
    inventory.insert("review.json".into(), identity::json(&result.review)?.into())?;
    side(
        result.before.as_ref(),
        ReviewSide::Before,
        &mut inventory,
        cancellation,
    )?;
    side(
        result.after.as_ref(),
        ReviewSide::After,
        &mut inventory,
        cancellation,
    )?;
    for removed in &result.snapshot.removed_entries {
        checkpoint(cancellation)?;
        let path = &removed.entry.metadata().path;
        let entry = records
            .remove(path)
            .ok_or_else(|| Error::Invalid { path: path.clone() })?;
        let preview = match removed.entry.kind() {
            EntryKind::Screen => Some(RemovedPreview::Screen),
            EntryKind::Page => Some(RemovedPreview::Page),
            EntryKind::Document => Some(RemovedPreview::Document),
            _ => None,
        };
        if matches!(removed.entry.kind(), EntryKind::Page | EntryKind::Document) {
            inventory.insert(
                routes::comparison_preview(path),
                identity::json(&Preview {
                    schema_version: 3,
                    base_ref: &result.snapshot.base_ref,
                    base_commit: &result.snapshot.base_commit,
                    path,
                })?
                .into(),
            )?;
        }
        index.removed_entries.push(RemovedEntry {
            entry,
            folder_titles: removed.folder_titles.clone(),
            parent_title: removed.parent_title.clone(),
            snapshot_id: Some(removed.snapshot_id.clone()),
            preview,
        });
        output.insert(format!("view/{path}/index.html"), stub.to_vec().into())?;
    }
    compare(projection_workspace::apply(&mut details, result))?;
    let (generation, files) = finalize(inventory, &mut details)?;
    index.comparison_url = Some(routes::comparison_review(&generation));
    let prefix = routes::comparison_generation(&generation);
    for file in files {
        output.insert(format!("{prefix}{}", file.path), file.bytes)?;
    }
    Ok(())
}

fn finalize(
    inventory: Inventory,
    details: &mut BTreeMap<String, EntryDetailV1>,
) -> Result<(String, Vec<File>)> {
    let mut files = inventory.into_files();
    let mut hashes: Vec<_> = files
        .iter()
        .map(|file| (file.path.clone(), digest(&file.bytes)))
        .collect();
    for (path, detail) in details.iter_mut() {
        detail.generation = Some("0".repeat(64));
        hashes.push((
            format!("entries/{path}.json"),
            digest(&identity::json(detail)?),
        ));
    }
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    let generation = digest(&identity::json(&hashes)?);
    for (path, detail) in details {
        detail.generation = Some(generation.clone());
        let bytes = identity::json(detail)?;
        if readers::detail(&String::from_utf8_lossy(&bytes)).is_err() {
            return Err(Error::Invalid {
                path: format!("entries/{path}.json"),
            });
        }
        files.push(File {
            path: format!("entries/{path}.json"),
            bytes: bytes.into(),
        });
    }
    Ok((generation, files))
}
