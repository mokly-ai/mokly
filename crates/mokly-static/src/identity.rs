//! Deployment identity includes exact bytes with only top-level id fields zeroed.

use std::collections::BTreeMap;

use mokly_model::canonical;
use mokly_model::namespace::viewer;
use mokly_model::output::artifact::File;
use mokly_model::output::validation::digest;
use mokly_model::public_detail::EntryDetailV2;
use mokly_model::public_index::CatalogueReadModel;
use serde::Serialize;

use crate::error::{InternalError, Result};

pub(crate) fn json<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    match canonical::to_string(value) {
        Ok(value) => Ok(value.into_bytes()),
        Err(source) => Err(InternalError::Model { source }.into()),
    }
}

/// Stamp one deterministic identity before ownership or publication metadata is added.
pub fn finalize(
    index: &mut CatalogueReadModel,
    details: &mut BTreeMap<String, EntryDetailV2>,
    other: &[File],
) -> Result<Vec<File>> {
    index.deployment_id = "0".repeat(64);
    for detail in details.values_mut() {
        detail.deployment_id = Some(index.deployment_id.clone());
    }
    let zeroed = records(index, details)?;
    let mut hashes: Vec<_> = other
        .iter()
        .chain(zeroed.iter())
        .map(|file| (file.path.clone(), digest(&file.bytes)))
        .collect();
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    index.deployment_id = digest(&json(&hashes)?);
    for detail in details.values_mut() {
        detail.deployment_id = Some(index.deployment_id.clone());
    }
    records(index, details)
}

fn records(
    index: &CatalogueReadModel,
    details: &BTreeMap<String, EntryDetailV2>,
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
