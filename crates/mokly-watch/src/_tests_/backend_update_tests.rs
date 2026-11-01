//! Captured batch results preserve attachment state through partial platform failures.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use notify::{PathOp, UpdatePathsError};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;

use super::{DirectoryWatch, NotifyWatch, PathUpdatesMock};

fn paths(values: &[&str]) -> BTreeSet<PathBuf> {
    values.iter().map(PathBuf::from).collect()
}

fn failed(
    mut operations: Vec<PathOp>,
    index: usize,
    source: notify::Error,
) -> Box<UpdatePathsError> {
    let remaining = operations.split_off(index + 1);
    Box::new(UpdatePathsError {
        source,
        origin: operations.pop(),
        remaining,
    })
}

#[test]
fn an_unknown_applied_prefix_keeps_previous_attachment_state_for_retry() {
    let native = Unimock::new((
        PathUpdatesMock::apply
            .next_call(matching!(_))
            .answers(&|_, _| {
                Err(Box::new(UpdatePathsError {
                    source: notify::Error::generic("batch reply lost"),
                    origin: None,
                    remaining: vec![],
                }))
            }),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 3))
            .answers(&|_, operations| {
                assert!(matches!(&operations[0], PathOp::Unwatch(path) if path == &PathBuf::from("/repo/old")));
                assert!(matches!(&operations[1], PathOp::Watch(path, _) if path == &PathBuf::from("/repo/a")));
                assert!(matches!(&operations[2], PathOp::Watch(path, _) if path == &PathBuf::from("/repo/b")));
                Ok(())
            }),
    ));
    let mut watcher = NotifyWatch {
        watcher: Box::new(native),
        attached: paths(&["/repo/old"]),
        tree: Arc::new(Unimock::new(())),
    };
    let add = paths(&["/repo/a", "/repo/b"]);
    let remove = paths(&["/repo/old"]);

    assert!(watcher.update(&add, &remove).is_err());
    assert_eq!(watcher.attached, remove);
    assert_eq!(watcher.update(&add, &remove).unwrap(), add);
    assert_eq!(watcher.attached, add);
}

#[test]
fn missing_removals_and_vanished_additions_do_not_stop_the_remaining_batch() {
    let native = Unimock::new((
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 5))
            .answers(&|_, operations| Err(failed(operations, 0, notify::Error::watch_not_found()))),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 4))
            .answers(&|_, operations| Err(failed(operations, 0, notify::Error::path_not_found()))),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 3))
            .answers(&|_, operations| Err(failed(operations, 1, notify::Error::path_not_found()))),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 1))
            .returns(Ok(())),
    ));
    let mut watcher = NotifyWatch {
        watcher: Box::new(native),
        attached: paths(&["/repo/old-a", "/repo/old-b"]),
        tree: Arc::new(Unimock::new(())),
    };
    let attached = paths(&["/repo/a", "/repo/c"]);
    assert_eq!(
        watcher
            .update(
                &paths(&["/repo/a", "/repo/b", "/repo/c"]),
                &paths(&["/repo/old-a", "/repo/old-b", "/repo/unattached"]),
            )
            .unwrap(),
        attached
    );
    assert_eq!(watcher.attached, attached);
    assert_eq!(
        watcher.update(&attached, &BTreeSet::new()).unwrap(),
        attached
    );
}

#[test]
fn other_failures_keep_the_first_error_and_still_apply_later_operations() {
    let native = Unimock::new((
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 5))
            .answers(&|_, operations| {
                Err(failed(
                    operations,
                    0,
                    notify::Error::generic("first failure"),
                ))
            }),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 4))
            .answers(&|_, operations| {
                Err(failed(
                    operations,
                    2,
                    notify::Error::generic("second failure"),
                ))
            }),
        PathUpdatesMock::apply
            .next_call(matching!((operations) if operations.len() == 1))
            .returns(Ok(())),
    ));
    let mut watcher = NotifyWatch {
        watcher: Box::new(native),
        attached: paths(&["/repo/old-a", "/repo/old-b"]),
        tree: Arc::new(Unimock::new(
            SourceTreeMock::project
                .next_call(matching!((path) if path == &PathBuf::from("/repo/b")))
                .returns(Ok(Some(Node {
                    identity: "/repo/b".into(),
                    kind: FileKind::Directory,
                    lexical_kind: FileKind::Directory,
                }))),
        )),
    };
    let error = watcher
        .update(
            &paths(&["/repo/a", "/repo/b", "/repo/c"]),
            &paths(&["/repo/old-a", "/repo/old-b"]),
        )
        .unwrap_err();
    assert!(
        matches!(error, Error::Observer { source } if matches!(&source.kind, notify::ErrorKind::Generic(message) if message == "first failure"))
    );
    assert_eq!(
        watcher.attached,
        paths(&["/repo/a", "/repo/c", "/repo/old-a"])
    );
}
