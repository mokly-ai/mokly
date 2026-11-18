//! Finalized byte snapshots, required artifacts and Plan archive structure.

use std::io::Read;

use flate2::read::GzDecoder;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::{INDEX, MANIFEST, MARKER, digest};

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
fn finalization_timestamp_changes_the_marker_and_keeps_content_digests() {
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
fn file_count_and_regular_file_limits_fail_before_upload_preparation() {
    let repeated = file("file", b"");
    let mut output = artifact(false);
    output.files = vec![repeated; 20_001];
    assert!(matches!(Prepared::new(&output), Err(Error::TooLarge)));
    output.files = vec![file("oversized", &vec![0; 64 * 1024 * 1024 + 1])];
    assert!(matches!(Prepared::new(&output), Err(Error::TooLarge)));
    assert!(matches!(
        mokly_model::output::ownership::Ownership::parse(&vec![b' '; 64 * 1024 * 1024 + 1])
            .upload(),
        Err(Error::TooLarge)
    ));
}
