//! Encode the removed details and previews without capturing snapshot documents.

use std::collections::BTreeMap;

use mokly_compare::{projection_index, projection_removed, projection_workspace};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::{readers, routes};

use crate::assets::File;
use crate::changes::Accepted;
use crate::error::{InternalError, Result, ServerError};
use crate::snapshot::{Snapshot, encode};

pub(crate) fn base(accepted: &Accepted, current: &Snapshot) -> Result<CatalogueReadModel> {
    let result = &accepted.result;
    let state =
        projection_index::publication(current.config_path.clone(), &result.snapshot.base_ref);
    compared(projection_index::base_index(result, &state))
}

pub(crate) fn files(accepted: &Accepted, current: &Snapshot) -> Result<BTreeMap<String, File>> {
    let result = &accepted.result;
    let historical = base(accepted, current)?;
    let mut details = compared(projection_removed::details(
        result,
        &historical,
        &accepted.id,
    ))?;
    projection_removed::workspaces(&mut details);
    compared(projection_workspace::apply(&mut details, result))?;
    let mut files = BTreeMap::new();
    for (path, detail) in details {
        let file = encode(&detail)?;
        if let Err(source) = readers::detail(&String::from_utf8_lossy(&file.bytes)) {
            return Err(InternalError::Read { source }.into());
        }
        files.insert(format!("entries/{path}.json"), file);
    }
    for preview in projection_removed::previews(result) {
        files.insert(routes::comparison_preview(&preview.path), encode(&preview)?);
    }
    Ok(files)
}

pub(crate) fn compared<T>(result: mokly_compare::error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(ServerError::Comparison {
            source: Box::new(source),
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_metadata_tests.rs"]
mod comparison_metadata_tests;
