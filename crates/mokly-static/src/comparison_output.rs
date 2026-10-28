//! Install one immutable comparison generation before the deployment identity is fixed.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_removed, projection_workspace};
use mokly_model::canonical;
use mokly_model::material::digest;
use mokly_model::output::artifact::File;
use mokly_model::public_detail::EntryDetailV3;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::review_affected::ReviewSide;
use mokly_model::{readers, routes};

use crate::comparison_files::{checkpoint, compare, side};
use crate::error::{Error, Result};
use crate::identity;
use crate::inventory::Inventory;
use crate::transaction::Cancellation;

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
    let mut details = compare(projection_removed::details(result, &historical))?;
    projection_removed::workspaces(&mut details);
    let mut inventory = Inventory::default();
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
    for preview in projection_removed::previews(result) {
        inventory.insert(
            routes::comparison_preview(&preview.path),
            identity::json(&preview)?.into(),
        )?;
    }
    let records = compare(projection_removed::records(result, historical))?;
    for record in records {
        checkpoint(cancellation)?;
        let path = record.entry.path().to_owned();
        index.removed_entries.push(record);
        output.insert(format!("view/{path}/index.html"), stub.to_vec().into())?;
    }
    compare(projection_workspace::apply(&mut details, result))?;
    let (generation, files) = finalize(inventory, &mut details)?;
    for record in &mut index.removed_entries {
        if let Some(detail) = details.get(record.entry.path()) {
            record.entry.set_detail_id(&detail.detail_id);
        }
    }
    index.comparison_url = Some(routes::comparison_generation(&generation));
    let prefix = routes::comparison_generation(&generation);
    for file in files {
        output.insert(format!("{prefix}{}", file.path), file.bytes)?;
    }
    Ok(())
}

fn finalize(
    inventory: Inventory,
    details: &mut BTreeMap<String, EntryDetailV3>,
) -> Result<(String, Vec<File>)> {
    let mut files = inventory.into_files();
    let mut hashes: Vec<_> = files
        .iter()
        .map(|file| (file.path.clone(), digest(&file.bytes)))
        .collect();
    for (path, detail) in details.iter_mut() {
        detail.detail_id = identity::detail_id(detail)?;
        hashes.push((
            format!("entries/{path}.json"),
            digest(&identity::json(detail)?),
        ));
    }
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    let generation = digest(&identity::json(&hashes)?);
    for (path, detail) in details {
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
