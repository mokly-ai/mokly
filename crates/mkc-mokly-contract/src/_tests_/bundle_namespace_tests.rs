//! Cloud namespace and private-path policy beyond the published marker shapes.

use serde_json::json;

use crate::error::{ArtifactKind, Error, Rejection};

use super::bundle_tests::{compared, entry, marker, plan, rejected, validate, with_marker};

#[test]
fn obsolete_namespace_and_cloud_roots_are_invalid_bundles() {
    for path in [
        "__mokly",
        "__MOKLY/catalogue.json",
        "__mokly/diffs/review.json",
        "_ACCESS/index.html",
        "__BLOBS/asset",
    ] {
        let result = validate(plan(&[entry(path, b"x")]));
        assert_eq!(result.unwrap_err().status_code(), 400, "{path}");
        let files = compared();
        let mut inventory = marker(&files);
        inventory["files"]
            .as_array_mut()
            .unwrap()
            .push(entry(path, b"x"));
        assert_eq!(
            validate(with_marker(files, &inventory))
                .unwrap_err()
                .status_code(),
            400,
            "{path}"
        );
    }
}

#[test]
fn generated_dependency_assets_and_authored_underscores_are_public() {
    for path in [
        "static/mokly-generated/assets/ts/node_modules/@scope/pkg/font.woff2",
        "static/mokly-generated/product/node_modules/example/index.mobile.html",
        "view/product/node_modules/example/index.html",
        "static/_authored/asset.json",
    ] {
        assert!(validate(plan(&[entry(path, b"x")])).is_ok(), "{path}");
    }
    let files = compared();
    let mut inventory = marker(&files);
    let index: serde_json::Value =
        serde_json::from_slice(&files["mokly-viewer/index.json"]).unwrap();
    let root = index["comparisonUrl"].as_str().unwrap();
    inventory["files"].as_array_mut().unwrap().push(entry(
        &format!(
            "{root}snapshots/before/mokly-generated/assets/ts/node_modules/@scope/pkg/font.woff2"
        ),
        b"font",
    ));
    assert!(validate(with_marker(files, &inventory)).is_ok());
}

#[test]
fn source_manifests_are_private_at_every_depth() {
    for path in [
        "MOKLY-MANIFEST.JSON",
        "static/mokly-generated/mokly-manifest.json",
        "static/mokly-generated/entry/Mokly-Manifest.Json",
    ] {
        rejected(plan(&[entry(path, b"{}")]), Rejection::PrivateFile);
    }
    let files = compared();
    let mut inventory = marker(&files);
    let index: serde_json::Value =
        serde_json::from_slice(&files["mokly-viewer/index.json"]).unwrap();
    let root = index["comparisonUrl"].as_str().unwrap();
    for path in [
        "snapshots/before/mokly-generated/MOKLY-MANIFEST.JSON",
        "summary.md",
    ] {
        let mut changed = inventory.clone();
        changed["files"]
            .as_array_mut()
            .unwrap()
            .push(entry(&format!("{root}{path}"), b"{}"));
        rejected(with_marker(files.clone(), &changed), Rejection::PrivateFile);
    }
    inventory["files"].as_array_mut().unwrap().push(entry(
        &format!("{root}snapshots/before/mokly-generated/entry/data.json"),
        b"{}",
    ));
    assert!(validate(with_marker(files, &inventory)).is_ok());
    assert!(
        validate(plan(&[entry(
            "static/mokly-generated/entry/data.json",
            b"{}"
        )]))
        .is_ok()
    );
    assert!(validate(plan(&[entry("static/mokly-manifest.json.backup", b"{}")])).is_ok());
}

#[test]
fn comparisons_use_only_the_pinned_generation() {
    for path in [
        "mokly-viewer/diffs",
        "mokly-viewer/diffs/review.json",
        "mokly-viewer/diffs/generations/other/review.json",
        "MOKLY-VIEWER/DIFFS/other/file.json",
    ] {
        rejected(plan(&[entry(path, b"x")]), Rejection::ComparisonFiles);
    }
    let files = compared();
    let mut inventory = marker(&files);
    inventory["files"].as_array_mut().unwrap().push(entry(
        &format!(
            "mokly-viewer/diffs/generations/{}/asset.json",
            "f".repeat(64)
        ),
        b"{}",
    ));
    rejected(with_marker(files, &inventory), Rejection::ComparisonFiles);
    assert!(
        validate(plan(&[entry(
            "mokly-viewer/catalogue.json",
            &serde_json::to_vec(&json!({})).unwrap()
        )]))
        .is_ok()
    );
}

#[test]
fn old_indexes_use_the_unsupported_index_error() {
    for version in [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 99] {
        let mut files = compared();
        let path = "mokly-viewer/index.json";
        let bytes = serde_json::to_vec(&json!({"schemaVersion":version,"future":true})).unwrap();
        let mut inventory = marker(&files);
        for declaration in inventory["files"].as_array_mut().unwrap() {
            if declaration["path"] == path {
                *declaration = entry(path, &bytes);
            }
        }
        files.insert(path.to_owned(), bytes.into());
        let error = validate(with_marker(files, &inventory)).unwrap_err();
        assert!(
            matches!(error, Error::UnsupportedVersion {artifact:ArtifactKind::Index, version:Some(received)} if received==version)
        );
        assert_eq!(error.status_code(), 426);
    }
}
