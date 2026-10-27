//! The `cargo xtask source-tree` output over a mocked boundary.

use std::path::Path;
use std::sync::Arc;

use unimock::{Clause, MockFn, Unimock, matching};

use crate::source_tree::error::Error;
use crate::source_tree::records::{Mode, Record, SourceFingerprint, fingerprint_records};
use crate::source_tree::system::{
    Entry, TreeEntryMock, TreeHeadMock, TreeIndexMock, TreeReadFileMock, TreeUntrackedMock,
};

use super::{SourceTreeRequest, source_tree_output};

const ROOT: &str = "/repository";
const HEAD: &str = "0123456789abcdef0123456789abcdef01234567";

/// A one-file tree.
fn tree() -> impl Clause {
    let index = format!("100644 {} 0\tfile.txt\0", "a".repeat(40)).into_bytes();
    (
        TreeIndexMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(index.clone()))),
        TreeUntrackedMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new())),
        TreeEntryMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(Entry::File { executable: false }))),
        TreeReadFileMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(b"CLI source".to_vec())),
    )
}

/// A `git rev-parse HEAD` read that prints `output`.
fn head(output: &'static str) -> impl Clause {
    TreeHeadMock
        .next_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| Ok(output.as_bytes().to_vec())))
}

fn fingerprint() -> SourceFingerprint {
    fingerprint_records(&[Record::new(
        Mode::Regular,
        b"file.txt".to_vec(),
        b"CLI source",
    )])
}

fn request(expected: Option<SourceFingerprint>, print_head: bool) -> SourceTreeRequest {
    SourceTreeRequest {
        expected,
        print_head,
    }
}

#[test]
fn the_output_holds_only_the_fingerprint_and_the_requested_head() {
    assert_eq!(
        source_tree_output(
            &Unimock::new(tree()),
            Path::new(ROOT),
            &request(None, false)
        )
        .unwrap(),
        format!("{}\n", fingerprint())
    );
    let probe = Unimock::new((tree(), head("0123456789abcdef0123456789abcdef01234567\n")));
    assert_eq!(
        source_tree_output(&probe, Path::new(ROOT), &request(Some(fingerprint()), true)).unwrap(),
        format!("{}\n{HEAD}\n", fingerprint())
    );
}

#[test]
fn a_different_fingerprint_fails_with_both_values_before_reading_head() {
    let expected = format!("sha256:{}", "0".repeat(64));
    let wrong = request(Some(SourceFingerprint::parse(&expected).unwrap()), true);
    let error = source_tree_output(&Unimock::new(tree()), Path::new(ROOT), &wrong).unwrap_err();
    assert!(matches!(error, Error::Mismatch { .. }));
    assert_eq!(
        error.to_string(),
        format!(
            "[xtask/source-tree] source-tree fingerprint does not match: expected {expected}; actual {}",
            fingerprint()
        )
    );
}

#[test]
fn a_head_that_is_not_one_full_lowercase_sha_fails() {
    for output in [
        "",
        "0123456789ABCDEF0123456789ABCDEF01234567\n",
        "abc\n",
        "0123456789abcdef0123456789abcdef0123456\n",
    ] {
        let system = Unimock::new((tree(), head(output)));
        let error = source_tree_output(&system, Path::new(ROOT), &request(None, true)).unwrap_err();
        assert!(matches!(error, Error::Head), "{output:?}");
        assert_eq!(
            error.to_string(),
            "[xtask/source-tree] expected a full lowercase HEAD SHA"
        );
    }
}
