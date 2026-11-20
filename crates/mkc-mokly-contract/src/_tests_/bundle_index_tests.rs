//! Plan agreement checks use the index's comparison identity and exact bytes.

use serde_json::{Value, json};

use crate::archive::ArchiveFiles;
use crate::error::{Error, Rejection};
use crate::index::INDEX_PATH;
use crate::index_values::ChangesStatus;

use super::bundle_tests::{compared, entry, marker, plan, rejected, validate, with_marker};

fn with_index(mut files: ArchiveFiles, index: &Value) -> ArchiveFiles {
    let bytes = serde_json::to_vec(index).unwrap();
    let mut inventory = marker(&files);
    for declaration in inventory["files"].as_array_mut().unwrap() {
        if declaration["path"] == INDEX_PATH {
            *declaration = entry(INDEX_PATH, &bytes);
        }
    }
    files.insert(INDEX_PATH.to_owned(), bytes.into());
    with_marker(files, &inventory)
}

#[test]
fn comparison_identity_and_status_must_agree_with_the_envelope() {
    let files = compared();
    let original: Value = serde_json::from_slice(&files[INDEX_PATH]).unwrap();
    for (field, value) in [
        ("base", json!("other")),
        ("baseCommit", json!("f".repeat(40))),
        ("comparisonUrl", Value::Null),
    ] {
        let mut index = original.clone();
        index[field] = value;
        rejected(
            with_index(files.clone(), &index),
            Rejection::ComparisonMetadata,
        );
    }
    let mut index = original;
    index["changesStatus"] = json!("unavailable");
    index["comparisonUrl"] = Value::Null;
    index.as_object_mut().unwrap().remove("baseCommit");
    rejected(with_index(files, &index), Rejection::ComparisonMetadata);
}

#[test]
fn current_only_plans_allow_disabled_or_unavailable_changes_only() {
    let files = plan(&[]);
    let original: Value = serde_json::from_slice(&files[INDEX_PATH]).unwrap();
    for (status, expected) in [
        ("disabled", ChangesStatus::Disabled),
        ("unavailable", ChangesStatus::Unavailable),
    ] {
        let mut index = original.clone();
        index["changesStatus"] = json!(status);
        index["base"] = json!("main");
        let bundle = validate(with_index(files.clone(), &index)).unwrap();
        assert_eq!(bundle.index().changes_status(), expected);
        assert_eq!(bundle.index().changes_count(), None);
        assert_eq!(bundle.index().comparison_generation(), None);
    }
    for status in ["preparing", "pending"] {
        let mut index = original.clone();
        index["changesStatus"] = json!(status);
        rejected(
            with_index(files.clone(), &index),
            Rejection::ComparisonMetadata,
        );
    }
    let mut index = original;
    index["comparisonUrl"] = json!(format!(
        "mokly-viewer/diffs/generations/{}/",
        "a".repeat(64)
    ));
    rejected(
        with_index(files.clone(), &index),
        Rejection::ComparisonMetadata,
    );
    let index: Value = serde_json::from_slice(&compared()[INDEX_PATH]).unwrap();
    rejected(with_index(files, &index), Rejection::ComparisonMetadata);
}

#[test]
fn index_digest_and_size_and_the_exact_three_artifact_order_are_preserved() {
    let files = compared();
    let bundle = validate(files.clone()).unwrap();
    assert_eq!(bundle.index_bytes(), &files[INDEX_PATH]);
    assert_eq!(
        bundle
            .artifacts()
            .iter()
            .map(|artifact| artifact.path.as_str())
            .collect::<Vec<_>>(),
        ["mokly-upload.json", ".mokly-export-artifact", INDEX_PATH]
    );
    for artifact in bundle.artifacts() {
        assert_eq!(artifact.bytes, files[&artifact.path]);
    }
    for field in ["sha256", "size"] {
        let mut inventory = marker(&files);
        let declaration = inventory["files"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|item| item["path"] == INDEX_PATH)
            .unwrap();
        declaration[field] = match field {
            "sha256" => json!("f".repeat(64)),
            _ => json!(1),
        };
        rejected(
            with_marker(files.clone(), &inventory),
            Rejection::ArtifactDigest,
        );
    }
    let mut changed = files;
    changed.insert(INDEX_PATH.to_owned(), b"{}".to_vec().into());
    assert!(matches!(
        validate(changed),
        Err(Error::Invalid {
            reason: Rejection::ArtifactDigest
        })
    ));
}
