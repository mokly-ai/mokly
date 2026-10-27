//! The in-process fingerprint adapter of the remote runner.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Fingerprint, InterruptRequestedMock};
use crate::remote::error::Error;
use crate::source_tree;
use crate::source_tree::records::fingerprint_records;
use crate::source_tree::system::{TreeIndexMock, TreeUntrackedMock};

use super::SourceTreeFingerprint;

fn interrupt(requested: bool) -> Arc<Unimock> {
    Arc::new(Unimock::new(
        InterruptRequestedMock
            .each_call(matching!())
            .returns(requested),
    ))
}

#[test]
fn the_adapter_returns_the_fingerprint_of_the_given_directory() {
    let tree = Unimock::new((
        TreeIndexMock
            .next_call(matching!((root) if *root == Path::new("/snapshot")))
            .answers(&|_, _| Ok(Vec::new())),
        TreeUntrackedMock
            .next_call(matching!((root) if *root == Path::new("/snapshot")))
            .answers(&|_, _| Ok(Vec::new())),
    ));
    let adapter = SourceTreeFingerprint {
        tree: Arc::new(tree),
        interrupt: interrupt(false),
    };
    assert_eq!(
        adapter.read(Path::new("/snapshot")).unwrap(),
        fingerprint_records(&[]).to_string()
    );
}

#[test]
fn an_interrupt_cancels_the_fingerprint_before_any_read() {
    let adapter = SourceTreeFingerprint {
        tree: Arc::new(Unimock::new(())),
        interrupt: interrupt(true),
    };
    assert!(matches!(
        adapter.read(Path::new("/workspace")),
        Err(Error::Cancelled)
    ));
}

#[test]
fn a_read_failure_keeps_its_typed_source_tree_error() {
    let tree = Unimock::new(TreeIndexMock.next_call(matching!(_)).answers(&|_, _| {
        Err(source_tree::error::Error::GitCommand {
            command: "git ls-files --stage -z".to_owned(),
            stderr: "fatal: not a git repository".to_owned(),
        })
    }));
    let adapter = SourceTreeFingerprint {
        tree: Arc::new(tree),
        interrupt: interrupt(false),
    };
    let error = adapter.read(Path::new("/workspace")).unwrap_err();
    assert!(matches!(
        error,
        Error::SourceTree {
            source: source_tree::error::Error::GitCommand { .. }
        }
    ));
    assert_eq!(
        error.to_string(),
        "[xtask/remote] [xtask/source-tree] `git ls-files --stage -z` failed: fatal: not a git repository"
    );
}
