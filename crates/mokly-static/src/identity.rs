//! Deployment identity includes exact bytes with only top-level id fields zeroed.

use std::collections::BTreeMap;

use mokly_model::canonical;
use mokly_model::namespace::viewer;
use mokly_model::output::artifact::File;
use mokly_model::output::validation::digest;
use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV3;
use mokly_model::public_index::CatalogueReadModel;
use serde::Serialize;

use crate::error::{InternalError, Result};

pub(crate) fn json<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    match canonical::to_string(value) {
        Ok(value) => Ok(value.into_bytes()),
        Err(source) => Err(InternalError::Model { source }.into()),
    }
}

pub(crate) fn detail_id(detail: &EntryDetailV3) -> Result<String> {
    match canonical::detail_id(detail) {
        Ok(id) => Ok(id),
        Err(source) => Err(InternalError::Model { source }.into()),
    }
}

/// Stamp one deterministic identity before ownership or publication metadata is added.
pub fn finalize(
    index: &mut CatalogueReadModel,
    details: &mut BTreeMap<String, EntryDetailV3>,
    other: &[File],
) -> Result<Vec<File>> {
    for detail in details.values_mut() {
        detail.detail_id = detail_id(detail)?;
    }
    projection::set_detail_ids(index, details);
    index.deployment_id = "0".repeat(64);
    let zeroed = records(index, details)?;
    let mut hashes: Vec<_> = other
        .iter()
        .chain(zeroed.iter())
        .map(|file| (file.path.clone(), digest(&file.bytes)))
        .collect();
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    index.deployment_id = digest(&json(&hashes)?);
    records(index, details)
}

fn records(
    index: &CatalogueReadModel,
    details: &BTreeMap<String, EntryDetailV3>,
) -> Result<Vec<File>> {
    let mut result = vec![File {
        path: viewer("index.json"),
        bytes: json(index)?.into(),
    }];
    for (path, detail) in details {
        result.push(File {
            path: viewer(&format!("entries/{path}.json")),
            bytes: tracing::info_span!("detail.build")
                .in_scope(|| json(detail))?
                .into(),
        });
    }
    Ok(result)
}
