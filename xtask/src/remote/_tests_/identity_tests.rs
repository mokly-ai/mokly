//! Exact identity evidence bytes and validated values without runtime I/O.

use crate::remote::error::Error;
use crate::remote::git_identity::{BaseCommit, CommitSha};
use crate::remote::identity::{RunId, RunIdentity};

/// The pure formatter matches the fixed protocol bytes, field order and newline.
#[test]
fn identity_json_matches_exact_fixture_bytes() {
    let identity = RunIdentity::new(
        RunId::new("20261006T120000Z", 42).unwrap(),
        CommitSha::read(&"b".repeat(40)).unwrap(),
        BaseCommit {
            sha: CommitSha::read(&"d".repeat(40)).unwrap(),
            ahead: 3,
        },
        &format!("sha256:{}", "a".repeat(64)),
    )
    .unwrap();
    assert_eq!(
        identity.json().as_bytes(),
        include_bytes!("fixtures/identity.json")
    );
}

/// Invalid names cannot reach snapshot paths or the evidence formatter.
#[test]
fn run_ids_reject_untrusted_directory_and_json_characters() {
    for stamp in [
        "",
        "20261006T120000Z/../../other",
        "20261006T12000\"Z",
        "20261006 120000Z",
    ] {
        assert!(matches!(RunId::new(stamp, 42), Err(Error::InvalidRunId)));
    }
}

/// Both HEAD and base use only the complete canonical Git SHA form.
#[test]
fn git_identities_require_full_lowercase_hex() {
    assert_eq!(
        CommitSha::read(&format!("{}\n", "a".repeat(40)))
            .unwrap()
            .as_str(),
        "a".repeat(40)
    );
    for value in [
        "",
        "HEAD",
        "abc123",
        &"A".repeat(40),
        &"g".repeat(40),
        &"a".repeat(39),
        &"a".repeat(41),
    ] {
        assert!(
            matches!(CommitSha::read(value), Err(Error::InvalidGitSha)),
            "{value}"
        );
    }
}

/// A malformed fingerprint never becomes otherwise-valid JSON evidence.
#[test]
fn identity_rejects_an_invalid_fingerprint() {
    let head = CommitSha::read(&"b".repeat(40)).unwrap();
    assert!(
        RunIdentity::new(
            RunId::new("20261006T120000Z", 42).unwrap(),
            head.clone(),
            BaseCommit {
                sha: head,
                ahead: 0
            },
            "invalid\"digest"
        )
        .is_err()
    );
}
