//! Framing bytes and object counts determine deterministic blob batches.

use crate::blob_batches::{cost, split};
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::tree::{Entry, Mode};

#[test]
fn framing_count_and_empty_queries_are_bounded() {
    let entry = Entry {
        path: RepoPath::parse("file").unwrap(),
        object: ObjectId::parse(&"a".repeat(40)).unwrap(),
        mode: Mode::File,
        size: 3,
    };
    let framed = cost(&entry);
    assert_eq!(framed, format!("{} blob 3\n", entry.object).len() + 3 + 1);
    let entries = vec![entry; 5];
    assert_eq!(split(&entries, framed * 2, 10).unwrap(), [0..2, 2..4, 4..5]);
    assert_eq!(split(&entries, framed * 10, 2).unwrap(), [0..2, 2..4, 4..5]);
    assert!(
        matches!(split(&entries, framed - 1, 2), Err(Error::BlobLimit { path, limit }) if path == "file" && limit == framed - 1)
    );
    assert!(split(&entries, framed, 0).is_err());
    assert!(split(&[], 1, 1).unwrap().is_empty());
}
