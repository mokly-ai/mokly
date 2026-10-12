//! Mocked filesystem and Git boundaries for partial snapshot lifecycle tests.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Output, ReporterExecutorMock};
use crate::remote::error::{Error, Operation};
use crate::remote::process::ProcessExecuteMock;
use crate::remote::snapshot::contracts::*;
use crate::remote::snapshot::system::SystemSnapshot;

/// The controlled failure point for build or removal.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Case {
    /// Return a command failure at the numbered build request.
    BuildFailure(usize),
    /// Panic at the numbered build request.
    BuildPanic(usize),
    /// A concurrent owner creates the directory after the absence probe.
    DirectoryCollision,
    /// A concurrent owner creates the index after directory reservation.
    IndexCollision,
    /// Removal of the worktree fails, but later steps must still run.
    RemoveFailure,
    /// Worktree removal panics, but later steps must still run.
    RemovePanic,
    /// Pruning fails and must not block index removal.
    PruneFailure,
}

/// Add a captured event without any real filesystem, clock or subprocess.
fn event(events: &Mutex<Vec<String>>, value: &str) {
    events.lock().unwrap().push(value.to_owned());
}

/// Preserve a typed operating-system failure for file boundaries.
fn failure() -> Error {
    Error::Io {
        operation: Operation::Snapshot,
        source: std::io::Error::other("file failure"),
    }
}

/// Compose explicit mocks and capture every ownership and process operation.
pub(super) fn fixture(case: Case) -> (SystemSnapshot, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let parent = events.clone();
    let absent = events.clone();
    let directory = events.clone();
    let absence_checks = AtomicUsize::new(0);
    let remove_directory = events.clone();
    let remove_index = events.clone();
    let files = Arc::new(
        Unimock::new((
            SnapshotFilesParentMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, root| {
                    assert_eq!(root, Path::new("/workspace"));
                    event(&parent, "parent");
                    Ok(())
                })),
            SnapshotFilesAbsentMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    event(&absent, "absent");
                    if absence_checks.fetch_add(1, Ordering::SeqCst) == 2
                        && case == Case::IndexCollision
                    {
                        return Err(Error::SnapshotExists {
                            path: path.to_owned(),
                        });
                    }
                    Ok(())
                })),
            SnapshotFilesDirectoryMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    event(&directory, "directory");
                    if case == Case::DirectoryCollision {
                        return Err(Error::SnapshotExists {
                            path: path.to_owned(),
                        });
                    }
                    Ok(())
                })),
            SnapshotFilesRemoveDirectoryMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    event(&remove_directory, "remove-directory");
                    Ok(())
                })),
            SnapshotFilesRemoveIndexMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    event(&remove_index, "remove-index");
                    Ok(())
                })),
        ))
        .no_verify_in_drop(),
    );
    let calls = AtomicUsize::new(0);
    let process_events = events.clone();
    let process = Arc::new(
        Unimock::new(
            ProcessExecuteMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    assert_eq!(request.program, "git");
                    assert!(!request.cancellable);
                    assert!(request.input.is_none());
                    let remove = request
                        .args
                        .starts_with(&["worktree".into(), "remove".into()]);
                    let prune = request.args == ["worktree", "prune"];
                    if remove || prune {
                        assert!(request.git_index.is_none());
                        assert_eq!(request.cwd, Path::new("/workspace"));
                        event(
                            &process_events,
                            if remove { "remove-worktree" } else { "prune" },
                        );
                        if remove && case == Case::RemovePanic {
                            panic!("remove dependency panics");
                        }
                        if (remove && case == Case::RemoveFailure)
                            || (prune && case == Case::PruneFailure)
                        {
                            return Err(failure());
                        }
                    } else {
                        let call = calls.fetch_add(1, Ordering::SeqCst);
                        event(&process_events, &format!("git:{call}"));
                        assert_eq!(request.git_index.is_some(), call < 3);
                        if case == Case::BuildPanic(call) {
                            panic!("build dependency panics");
                        }
                        if case == Case::BuildFailure(call) {
                            return Err(failure());
                        }
                    }
                    Ok(Output {
                        stdout: if request.args == ["write-tree"] {
                            "a".repeat(40)
                        } else {
                            String::new()
                        },
                        code: Some(0),
                        ..Output::default()
                    })
                })),
        )
        .no_verify_in_drop(),
    );
    let reports = events.clone();
    let reporter = Arc::new(
        Unimock::new(
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    event(&reports, &format!("warning:{message}"));
                })),
        )
        .no_verify_in_drop(),
    );
    (
        SystemSnapshot {
            process,
            files,
            reporter,
            workspace: "/workspace".into(),
        },
        events,
    )
}
