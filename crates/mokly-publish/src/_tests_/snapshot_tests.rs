//! Finalized byte snapshots, required artifacts and Plan archive structure.

use std::io::Read;

use flate2::read::GzDecoder;
use serde_json::json;

use crate::error::Error;
use crate::snapshot::{Artifact, OutputSnapshot};
use crate::validation::{MANIFEST, MARKER, digest};

use super::support::{artifact, file, inventory, publication};

#[test]
fn plan_archive_has_only_exact_finalized_files_in_fixed_order() {
    for comparison in [false, true] {
        let output = artifact(comparison);
        let prepared = output.prepare().unwrap();
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
        assert_eq!(archived.len(), if comparison { 3 } else { 2 });
        assert_eq!(archived[0].0, MANIFEST);
        assert_eq!(archived[1].0, MARKER);
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
        assert_eq!(prepared.archive, output.prepare().unwrap().archive);
        assert_eq!(output.capture().unwrap().files.len(), output.files.len());
    }
}

#[test]
fn output_inventory_requires_every_file_and_rejects_mutated_or_unexpected_bytes() {
    for path in ["index.html", "404.html", MANIFEST, MARKER, "static/one.txt"] {
        let mut output = artifact(false);
        output.files.retain(|file| file.path != path);
        assert!(
            matches!(output.prepare(), Err(Error::InvalidBundle)),
            "{path}"
        );
    }
    let mut output = artifact(false);
    output.files.push(file("unexpected.txt", b"unexpected"));
    assert!(output.prepare().is_err());
    let mut output = artifact(false);
    output.files.push(output.files[0].clone());
    assert!(output.prepare().is_err());
    let mut output = artifact(false);
    output
        .files
        .iter_mut()
        .find(|file| file.path == "static/one.txt")
        .unwrap()
        .bytes = b"changed".as_slice().into();
    assert!(output.prepare().is_err());
    assert!(
        Artifact::finalize(
            "/private/build".into(),
            &publication(),
            &inventory(false),
            vec![
                file("index.html", b"shell"),
                file("404.html", b"shell"),
                file("STATIC/a", b"a"),
                file("static/A", b"b")
            ]
        )
        .is_err()
    );
}

#[test]
fn comparison_path_and_base_are_pinned_and_current_only_has_no_comparison_files() {
    for (field, value) in [
        ("schemaVersion", json!(7)),
        ("baseRef", json!("other")),
        ("baseCommit", json!("d".repeat(40))),
    ] {
        let output = artifact(true);
        let prepared = output.prepare().unwrap();
        let path = prepared.metadata.comparison_path.unwrap();
        let mut files = output
            .files
            .into_iter()
            .filter(|file| file.path != MANIFEST && file.path != MARKER)
            .collect::<Vec<_>>();
        let review = files.iter_mut().find(|file| file.path == path).unwrap();
        let mut document: serde_json::Value = serde_json::from_slice(&review.bytes).unwrap();
        document[field] = value;
        review.bytes = serde_json::to_vec(&document).unwrap().into();
        assert!(
            Artifact::finalize(
                "/private/build".into(),
                &publication(),
                &inventory(true),
                files
            )
            .is_err()
        );
    }
    let files = vec![
        file("index.html", b"shell"),
        file("404.html", b"shell"),
        file("mokly-viewer/diffs/generations/old/review.json", b"{}"),
    ];
    assert!(
        Artifact::finalize(
            "/private/build".into(),
            &publication(),
            &inventory(false),
            files
        )
        .is_err()
    );
    let mut first = inventory(false);
    let files = vec![file("index.html", b"shell"), file("404.html", b"shell")];
    let before = Artifact::finalize(
        "/private/build".into(),
        &publication(),
        &first,
        files.clone(),
    )
    .unwrap();
    first.exported_at = "2026-09-26T12:01:00.000Z".to_owned();
    let after = Artifact::finalize("/private/build".into(), &publication(), &first, files).unwrap();
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
        before.prepare().unwrap().ownership.files[0].sha256
    );
}

#[test]
fn file_count_and_regular_file_limits_fail_before_marker_decoding_or_hashing() {
    let repeated = file("file", b"");
    let output = Artifact {
        directory: "/private/build".into(),
        files: vec![repeated; 20_001],
    };
    assert!(matches!(output.prepare(), Err(Error::TooLarge)));
    let output = Artifact {
        directory: "/private/build".into(),
        files: vec![file("oversized", &vec![0; 64 * 1024 * 1024 + 1])],
    };
    assert!(matches!(output.prepare(), Err(Error::TooLarge)));
    assert!(matches!(
        crate::ownership::Ownership::parse(&vec![b' '; 64 * 1024 * 1024 + 1]),
        Err(Error::TooLarge)
    ));
}
