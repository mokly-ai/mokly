//! Install one immutable comparison generation before the deployment identity is fixed.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_removed, projection_workspace};
use mokly_model::canonical;
use mokly_model::material::digest;
use mokly_model::namespace;
use mokly_model::nullable::Nullable;
use mokly_model::output::artifact::File;
use mokly_model::output::inventory::Inventory;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::review_affected::ReviewSide;
use mokly_model::routes;

use crate::admission::AdmissionResult;
use crate::comparison_files::{checkpoint, compare, side};
use crate::error::Result;
use crate::identity;
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
    let historical = projection_index::base_index(result, &state);
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
    faces(output, &mut inventory)?;
    for preview in projection_removed::previews(result) {
        inventory
            .insert(
                routes::comparison_preview(&preview.path),
                identity::json(&preview).into(),
            )
            .admit()?;
    }
    let records = projection_removed::records(result, historical);
    for record in records {
        checkpoint(cancellation)?;
        let path = record.entry.path().to_owned();
        index.removed_entries.push(record);
        output
            .insert(format!("view/{path}/index.html"), stub.to_vec().into())
            .admit()?;
    }
    compare(projection_workspace::apply(&mut details, result))?;
    let (generation, files) = finalize(&inventory, &mut details);
    for record in &mut index.removed_entries {
        if let Some(detail) = details.get(record.entry.path()) {
            record.entry.set_detail_id(&detail.detail_id);
        }
    }
    index.comparison_url = Nullable(Some(routes::comparison_generation(&generation)));
    let prefix = routes::comparison_generation(&generation);
    for file in inventory.files().chain(files.iter()) {
        output
            .insert(format!("{prefix}{}", file.path), file.bytes.clone())
            .admit()?;
    }
    Ok(())
}

/// Copy each viewer face that the output delivers into the generation, with its
/// exact bytes, so that the unchanged relative face address of a snapshot document
/// resolves inside the generation. The copies join the generation's digest.
fn faces(output: &Inventory, inventory: &mut Inventory) -> Result<()> {
    for face in namespace::FONT_FACES {
        let delivered = namespace::viewer(face);
        if let Some(file) = output.files().find(|file| file.path == delivered) {
            inventory
                .insert(namespace::snapshot_viewer(face), file.bytes.clone())
                .admit()?;
        }
    }
    Ok(())
}

fn finalize(
    inventory: &Inventory,
    details: &mut BTreeMap<String, EntryDetailV4>,
) -> (String, Vec<File>) {
    let mut files = Vec::new();
    let mut hashes: Vec<_> = inventory
        .files()
        .map(|file| (file.path.clone(), digest(&file.bytes)))
        .collect();
    for (path, detail) in details {
        detail.detail_id = identity::detail_id(detail);
        let path = format!("entries/{path}.json");
        let bytes = identity::json(detail);
        hashes.push((path.clone(), digest(&bytes)));
        files.push(File {
            path,
            bytes: bytes.into(),
        });
    }
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    let generation = digest(&identity::json(&hashes));
    (generation, files)
}
