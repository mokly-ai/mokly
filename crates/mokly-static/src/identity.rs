//! Deployment identity includes exact bytes with only top-level id fields zeroed.

use std::collections::BTreeMap;

use mokly_model::canonical;
use mokly_model::namespace::viewer;
use mokly_model::output::artifact::File;
use mokly_model::output::validation::digest;
use mokly_model::projection;
use mokly_model::public_detail::EntryDetailV4;
use mokly_model::public_index::CatalogueReadModel;
use serde::Serialize;

pub(crate) fn json(value: &impl Serialize) -> Vec<u8> {
    canonical::to_string(value)
        .expect("The private static encoder receives only Mokly JSON shapes with string map keys")
        .into_bytes()
}

pub(crate) fn detail_id(detail: &EntryDetailV4) -> String {
    canonical::detail_id(detail)
        .expect("EntryDetailV4 has only typed JSON fields and string map keys")
}

/// Stamp one deterministic identity before ownership or publication metadata is added.
pub fn finalize<'a>(
    index: &mut CatalogueReadModel,
    details: &mut BTreeMap<String, EntryDetailV4>,
    other: impl IntoIterator<Item = &'a File>,
) -> Vec<File> {
    for detail in details.values_mut() {
        detail.detail_id = detail_id(detail);
    }
    projection::set_detail_ids(index, details);
    index.deployment_id = "0".repeat(64);
    let mut files = records(index, details);
    let hash = |file: &File| (file.path.clone(), digest(&file.bytes));
    let mut hashes: Vec<_> = other
        .into_iter()
        .map(hash)
        .chain(files.iter().map(hash))
        .collect();
    hashes.sort_by(|a, b| canonical::compare_utf16(&a.0, &b.0));
    index.deployment_id = digest(&json(&hashes));
    files[0].bytes = json(index).into();
    files
}

fn records(index: &CatalogueReadModel, details: &BTreeMap<String, EntryDetailV4>) -> Vec<File> {
    let mut result = vec![File {
        path: viewer("index.json"),
        bytes: json(index).into(),
    }];
    for (path, detail) in details {
        result.push(File {
            path: viewer(&format!("entries/{path}.json")),
            bytes: tracing::info_span!("detail.build")
                .in_scope(|| json(detail))
                .into(),
        });
    }
    result
}
