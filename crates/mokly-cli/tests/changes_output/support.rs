//! The binary under test and readers for build output documents.

use std::fs;
use std::path::Path;

use mokly_test_support::files::write;
use mokly_test_support::process::Mokly;
use mokly_test_support::publication;
use serde_json::Value;
use tempfile::TempDir;

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// The publication fixture with Changes against `fixture-base`.
pub(super) fn based(javascript: bool) -> TempDir {
    let root = publication::fixture(javascript, "sha1");
    write(
        root.path(),
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"}}"#,
    );
    root
}

/// Parse the JSON file `name` below `output`.
pub(super) fn json(output: &Path, name: &str) -> Value {
    serde_json::from_slice(&fs::read(output.join(name)).unwrap()).unwrap()
}

/// The current entries of every kind in index order.
pub(super) fn current(index: &Value) -> Vec<&Value> {
    ["screens", "components", "pages", "documents", "useCases"]
        .into_iter()
        .flat_map(|kind| index[kind].as_array().unwrap())
        .collect()
}

/// The entries of the removed records.
pub(super) fn removed(index: &Value) -> Vec<&Value> {
    index["removedEntries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|record| &record["entry"])
        .collect()
}

/// Whether `entry` is a ready, included change.
pub(super) fn included(entry: &Value) -> bool {
    entry["changes"]["status"] == "ready" && entry["changes"]["included"] == true
}

/// The folder of the comparison generation, without a final slash.
pub(super) fn generation(index: &Value) -> String {
    let url = index["comparisonUrl"].as_str().unwrap();
    url.rsplit_once('/').unwrap().0.to_owned()
}

/// The entry with `path` in the index list `kind`.
pub(super) fn entry<'a>(index: &'a Value, kind: &str, path: &str) -> &'a Value {
    index[kind]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["path"] == path)
        .unwrap_or_else(|| panic!("{kind} has no {path}"))
}
