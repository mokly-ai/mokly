//! The shared marker writer serves both plain build and publication finalization.

use crate::output::artifact::Artifact;
use crate::output::error::FormatError;
use crate::output::inventory::Inventory;
use crate::output::ownership::Ownership;
use crate::output::validation::{MANIFEST, MARKER, digest};
use crate::versions::EXPORT_OWNERSHIP;

#[test]
fn plain_build_uses_the_same_sorted_writer_without_upload_metadata() {
    let mut files = Inventory::default();
    for path in ["index.html", "404.html"] {
        files
            .insert(path.into(), b"shell".as_slice().into())
            .unwrap();
    }
    let output = Artifact::finalize("/site".into(), files, None).unwrap();
    assert!(!output.files.iter().any(|file| file.path == MANIFEST));
    let marker = output.files.last().unwrap();
    assert_eq!(marker.path, MARKER);
    let marker = Ownership::parse(&marker.bytes).unwrap();
    assert_eq!(marker.schema_version, EXPORT_OWNERSHIP);
    assert_eq!(
        marker
            .files
            .iter()
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>(),
        ["404.html", "index.html"]
    );
    for entry in marker.files {
        assert_eq!(entry.sha256, digest(b"shell"));
        assert_eq!(entry.size, 5);
    }
}

#[test]
fn marker_writer_has_no_publication_file_count_ceiling() {
    let mut files = Inventory::default();
    for index in 0..20_000 {
        files
            .insert(format!("file-{index:05}"), Vec::new().into())
            .unwrap();
    }
    let output = Artifact::finalize("/site".into(), files, None).unwrap();
    assert_eq!(output.files.len(), 20_001);
    assert_eq!(
        Ownership::parse(&output.files.last().unwrap().bytes)
            .unwrap()
            .files
            .len(),
        20_000
    );
}

#[test]
fn marker_writer_rejects_a_marker_above_the_regular_file_limit() {
    let first_padding = "p".repeat(245);
    let segment = "p".repeat(249);
    let leaf = "p".repeat(24);
    let suffix = format!("{segment}/{segment}/{segment}/{leaf}");
    // Each distinct portable path has 1,024 ASCII bytes. Their text alone is 64 MiB.
    let mut files = Inventory::default();
    for index in 0..65_536 {
        files
            .insert(
                format!("{index:04x}{first_padding}/{suffix}"),
                Vec::new().into(),
            )
            .unwrap();
    }
    assert!(matches!(
        Artifact::finalize("/site".into(), files, None),
        Err(FormatError::TooLarge)
    ));
}
