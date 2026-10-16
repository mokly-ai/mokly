//! Oversized regular blobs stream to disk under the aggregate extraction bound.

use std::fs;
use std::sync::Arc;

use mokly_git::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use mokly_git::control::Token;
use mokly_git::error::Error;
use mokly_git::tree::Limits;

use support::{Fixture, runner};

mod support;

#[test]
fn one_blob_larger_than_a_batch_and_capture_limit_extracts_exactly() {
    let fixture = Fixture::new();
    let bytes = vec![173; 70 * 1024 * 1024];
    fixture.write("a-before.txt", b"before");
    fixture.write("large.bin", &bytes);
    fixture.write("z-after.txt", b"after");
    let base = fixture.commit();
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("base");
    let repository = fixture.repository();
    let total = bytes.len() + 11;
    let limits = Limits {
        bytes: total,
        ..Limits::default()
    };
    repository.extract(&base, &target, limits).unwrap();
    assert_eq!(fs::read(target.join("large.bin")).unwrap(), bytes);
    assert_eq!(fs::read(target.join("a-before.txt")).unwrap(), b"before");
    assert_eq!(fs::read(target.join("z-after.txt")).unwrap(), b"after");
    let rejected = temporary.path().join("rejected");
    assert!(matches!(
        repository.extract(&base, &rejected, Limits { bytes: total - 1, ..limits }),
        Err(Error::ByteLimit { limit }) if limit == total - 1
    ));
    assert!(!rejected.exists());
}

#[test]
fn a_failed_streaming_git_command_keeps_its_command_failure() {
    let fixture = Fixture::new();
    let result = runner(Arc::new(Token::default())).copy(
        &Request {
            directory: fixture.root().into(),
            args: vec!["cat-file".into(), "blob".into(), "0".repeat(40).into()],
            stdin: Vec::new(),
            output_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_STDERR_LIMIT,
        },
        &mut Vec::new(),
        70 * 1024 * 1024,
    );
    assert!(
        matches!(result, Err(Error::CommandFailed { .. })),
        "{result:?}"
    );
}
