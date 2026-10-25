//! The shared marker writer serves both plain build and publication finalization.

use crate::output::artifact::{Artifact, File};
use crate::output::ownership::Ownership;
use crate::output::validation::{MANIFEST, MARKER, digest};
use crate::versions::EXPORT_OWNERSHIP;

#[test]
fn plain_build_uses_the_same_sorted_writer_without_upload_metadata() {
    let files = vec![
        File {
            path: "index.html".to_owned(),
            bytes: b"shell".as_slice().into(),
        },
        File {
            path: "404.html".to_owned(),
            bytes: b"shell".as_slice().into(),
        },
    ];
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
    let files = (0..20_000)
        .map(|index| File {
            path: format!("file-{index:05}"),
            bytes: Vec::new().into(),
        })
        .collect();
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
