//! A process keeps the first fingerprints of each extraction.

use std::path::Path;
use std::sync::Arc;

use mokly_git::extracted::ExtractedFiles;

use crate::extraction_snapshots::{ProcessSnapshots, Snapshots};

#[test]
fn the_first_fingerprints_of_each_extraction_stay() {
    let snapshots = ProcessSnapshots::default();
    assert!(snapshots.get(Path::new("/a")).is_none());
    let first = snapshots.keep(ExtractedFiles::unproved("/a".into()));
    let later = snapshots.keep(ExtractedFiles::unproved("/a".into()));
    let other = snapshots.keep(ExtractedFiles::unproved("/b".into()));
    assert!(Arc::ptr_eq(&first, &later));
    assert!(Arc::ptr_eq(
        &first,
        &snapshots.get(Path::new("/a")).unwrap()
    ));
    assert_eq!(other.root(), Path::new("/b"));
}
