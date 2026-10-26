//! Finalized byte snapshots, required artifacts and Plan archive structure.

use std::io::Read;

use flate2::read::GzDecoder;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::{INDEX, MANIFEST, MARKER, digest};
use serde_json::json;

use crate::error::{Error, OutputResult};
use crate::snapshot::Prepared;
use crate::snapshot::{Finalized, OutputSnapshot};

use super::support::{artifact, file, inventory, publication};

#[test]
fn plan_archive_has_only_exact_finalized_files_in_fixed_order() {
    for comparison in [false, true] {
        let output = artifact(comparison);
        let prepared = Prepared::new(&output).unwrap();
        let mut tar = tar::Archive::new(GzDecoder::new(prepared.archive.as_ref()));
        let archived: Vec<_> = tar
            .entries()
            .unwrap()
            .map(|entry| {
                let mut entry = entry.unwrap();
                assert!(entry.header().entry_type().is_file());
                assert_eq!(entry.header().uid().unwrap(), 0);
                assert_eq!(entry.header().mtime().unwrap(), 0);
                let name = entry.path().unwrap().to_str().unwrap().to_owned();
                let mut bytes = Vec::new();
                entry.read_to_end(&mut bytes).unwrap();
                (name, bytes)
            })
            .collect();
        assert_eq!(archived.len(), 3);
        assert_eq!(archived[0].0, MANIFEST);
        assert_eq!(archived[1].0, MARKER);
        assert_eq!(archived[2].0, INDEX);
        for (path, bytes) in archived {
            assert_eq!(
                bytes,
                output
                    .files
                    .iter()
                    .find(|file| file.path == path)
                    .unwrap()
                    .bytes
            );
        }
        assert_eq!(prepared.archive, Prepared::new(&output).unwrap().archive);
        let finalized = Finalized::new(output.clone()).unwrap();
        let captured = finalized.capture().unwrap();
        assert_eq!(captured.artifact().files.len(), output.files.len());
        assert!(std::ptr::eq(finalized.prepared(), captured.prepared()));
    }
}

#[test]
fn output_inventory_requires_every_file_and_rejects_mutated_or_unexpected_bytes() {
    for path in [
        "index.html",
        "404.html",
        MANIFEST,
        MARKER,
        INDEX,
        "static/one.txt",
    ] {
        let mut output = artifact(false);
        output.files.retain(|file| file.path != path);
        assert!(
            matches!(Prepared::new(&output), Err(Error::InvalidBundle)),
            "{path}"
        );
    }
    let mut output = artifact(false);
    output.files.push(file("unexpected.txt", b"unexpected"));
    assert!(Prepared::new(&output).is_err());
    let mut output = artifact(false);
    output.files.push(output.files[0].clone());
    assert!(Prepared::new(&output).is_err());
    let mut output = artifact(false);
    output
        .files
        .iter_mut()
        .find(|file| file.path == "static/one.txt")
        .unwrap()
        .bytes = b"changed".as_slice().into();
    assert!(Prepared::new(&output).is_err());
    assert!(
        Artifact::finalize(
            "/private/build".into(),
            vec![
                file("index.html", b"shell"),
                file("404.html", b"shell"),
                file("STATIC/a", b"a"),
                file("static/A", b"b")
            ],
            Some(publication().metadata(&inventory(false)).unwrap())
        )
        .is_err()
    );
}

#[test]
fn index_base_and_commit_are_pinned_and_current_only_has_no_comparison_files() {
    for (comparison, field, value) in [
        (true, "schemaVersion", json!(7)),
        (true, "baseCommit", json!(null)),
        (true, "baseCommit", json!("d".repeat(40))),
        (true, "base", json!("origin/other")),
        (false, "baseCommit", json!("b".repeat(40))),
    ] {
        let mut files = artifact(comparison)
            .files
            .into_iter()
            .filter(|file| file.path != MANIFEST && file.path != MARKER)
            .collect::<Vec<_>>();
        let index = files.iter_mut().find(|file| file.path == INDEX).unwrap();
        let mut document: serde_json::Value = serde_json::from_slice(&index.bytes).unwrap();
        document[field] = value;
        index.bytes = serde_json::to_vec(&document).unwrap().into();
        let output = Artifact::finalize(
            "/private/build".into(),
            files,
            Some(publication().metadata(&inventory(comparison)).unwrap()),
        )
        .unwrap();
        assert!(Prepared::new(&output).is_err(), "{field}");
    }
    let mut files = artifact(false).files;
    files.retain(|file| file.path != MANIFEST && file.path != MARKER);
    files.push(file(
        "mokly-viewer/diffs/generations/old/entries/a.json",
        b"{}",
    ));
    let output = Artifact::finalize(
        "/private/build".into(),
        files,
        Some(publication().metadata(&inventory(false)).unwrap()),
    )
    .unwrap();
    assert!(Prepared::new(&output).is_err());
    let mut first = inventory(false);
    let mut files = artifact(false).files;
    files.retain(|file| file.path != MANIFEST && file.path != MARKER);
    let before = Artifact::finalize(
        "/private/build".into(),
        files.clone(),
        Some(publication().metadata(&first).unwrap()),
    )
    .unwrap();
    first.exported_at = "2026-09-26T12:01:00.000Z".to_owned();
    let after = Artifact::finalize(
        "/private/build".into(),
        files,
        Some(publication().metadata(&first).unwrap()),
    )
    .unwrap();
    assert_ne!(
        before
            .files
            .iter()
            .find(|file| file.path == MARKER)
            .unwrap()
            .bytes,
        after
            .files
            .iter()
            .find(|file| file.path == MARKER)
            .unwrap()
            .bytes
    );
    assert_eq!(
        digest(b"shell"),
        Prepared::new(&before).unwrap().ownership.files[0].sha256
    );
}

#[test]
fn file_count_and_regular_file_limits_fail_before_marker_decoding_or_hashing() {
    let repeated = file("file", b"");
    let output = Artifact {
        directory: "/private/build".into(),
        files: vec![repeated; 20_001],
    };
    assert!(matches!(Prepared::new(&output), Err(Error::TooLarge)));
    let output = Artifact {
        directory: "/private/build".into(),
        files: vec![file("oversized", &vec![0; 64 * 1024 * 1024 + 1])],
    };
    assert!(matches!(Prepared::new(&output), Err(Error::TooLarge)));
    assert!(matches!(
        mokly_model::output::ownership::Ownership::parse(&vec![b' '; 64 * 1024 * 1024 + 1])
            .upload(),
        Err(Error::TooLarge)
    ));
}

#[test]
fn a_shared_digest_with_different_declared_sizes_is_a_valid_shape_but_invalid_bytes() {
    let mut output = artifact(false);
    let marker = output
        .files
        .iter_mut()
        .find(|file| file.path == MARKER)
        .unwrap();
    let mut document: serde_json::Value = serde_json::from_slice(&marker.bytes).unwrap();
    let entries = document["files"].as_array_mut().unwrap();
    let index = entries
        .iter()
        .position(|entry| entry["path"] == "static/same.txt")
        .unwrap();
    entries[index]["size"] = json!(99);
    marker.bytes = serde_json::to_vec(&document).unwrap().into();
    assert!(mokly_model::output::ownership::Ownership::parse(&marker.bytes).is_ok());
    assert!(matches!(Prepared::new(&output), Err(Error::InvalidBundle)));
}

#[test]
fn streaming_index_identity_rejects_duplicate_keys_inside_discarded_fields() {
    for unknown in [r#"{"nested":{"x":1,"x":2}}"#, r#"[{"x":1,"x":2}]"#] {
        let mut output = artifact(true);
        let index = output
            .files
            .iter_mut()
            .find(|file| file.path == INDEX)
            .unwrap();
        let source = format!(
            "{{\"schemaVersion\":8,\"base\":\"origin/main\",\"baseCommit\":\"{}\",\"unknown\":{unknown}}}",
            "b".repeat(40)
        );
        index.bytes = source.into();
        let files = output
            .files
            .into_iter()
            .filter(|file| file.path != MARKER && file.path != MANIFEST)
            .collect();
        let output = Artifact::finalize(
            "/private/build".into(),
            files,
            Some(publication().metadata(&inventory(true)).unwrap()),
        )
        .unwrap();
        assert!(matches!(Prepared::new(&output), Err(Error::InvalidBundle)));
    }
}
