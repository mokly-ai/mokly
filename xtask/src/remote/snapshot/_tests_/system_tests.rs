//! Unit-test partial snapshot ownership and cleanup with injected process and file mocks.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Output, ReporterExecutorMock};
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::process::ProcessExecuteMock;
use crate::remote::snapshot::contracts::*;
use crate::remote::snapshot::system::SystemSnapshot;

/// The controlled failure point for build or removal.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Case {
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
fn fixture(case: Case) -> (SystemSnapshot, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let parent = events.clone();
    let absent = events.clone();
    let directory = events.clone();
    let index = events.clone();
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
                .answers_arc(Arc::new(move |_, _| {
                    event(&absent, "absent");
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
            SnapshotFilesIndexMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    event(&index, "index");
                    if case == Case::IndexCollision {
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

/// Every partial build releases only acquired paths on both errors and panic unwind.
#[test]
fn failed_and_panicking_builds_remove_partial_resources_before_return() {
    for stage in 0..6 {
        for panic in [false, true] {
            let case = if panic {
                Case::BuildPanic(stage)
            } else {
                Case::BuildFailure(stage)
            };
            let (snapshot, events) = fixture(case);
            let outcome = catch_unwind(AssertUnwindSafe(|| {
                snapshot.create(
                    &RunId::new("20261006T120000Z", 42).unwrap(),
                    &CommitSha::read(&"b".repeat(40)).unwrap(),
                )
            }));
            assert_eq!(outcome.is_err(), panic);
            if let Ok(result) = outcome {
                assert!(result.is_err());
            }
            let events = events.lock().unwrap();
            assert_eq!(
                &events[..5],
                ["parent", "absent", "absent", "directory", "index"]
            );
            let removal = if stage >= 3 {
                "remove-worktree"
            } else {
                "remove-directory"
            };
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.as_str() == removal)
                    .count(),
                1,
                "{case:?}"
            );
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.as_str() == "prune")
                    .count(),
                1
            );
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.as_str() == "remove-index")
                    .count(),
                1
            );
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.starts_with("warning:"))
                    .count(),
                0
            );
        }
    }
}

/// A raced collision cannot transfer ownership of the existing resource.
#[test]
fn reservation_collisions_never_remove_the_foreign_directory_or_index() {
    for case in [Case::DirectoryCollision, Case::IndexCollision] {
        let (snapshot, events) = fixture(case);
        assert!(matches!(
            snapshot.create(
                &RunId::new("20261006T120000Z", 42).unwrap(),
                &CommitSha::read(&"b".repeat(40)).unwrap()
            ),
            Err(Error::SnapshotExists { .. })
        ));
        let events = events.lock().unwrap();
        assert!(!events.iter().any(|event| event.starts_with("git:")));
        assert!(!events.iter().any(|event| event == "remove-index"));
        assert_eq!(
            events
                .iter()
                .filter(|event| event.as_str() == "remove-directory")
                .count(),
            usize::from(case == Case::IndexCollision)
        );
    }
}

/// Both cleanup Git operations and index removal survive any earlier failure or panic.
#[test]
fn cleanup_always_attempts_prune_and_index_removal_after_failures() {
    for case in [Case::RemoveFailure, Case::RemovePanic, Case::PruneFailure] {
        let (snapshot, events) = fixture(case);
        let mut handle = SnapshotHandle::paths(
            Path::new("/workspace"),
            &RunId::new("20261006T120000Z", 42).unwrap(),
        );
        handle.ownership = Ownership::Linked;
        assert!(snapshot.remove(&handle).is_err());
        assert_eq!(
            *events.lock().unwrap(),
            ["remove-worktree", "prune", "remove-index"]
        );
    }
}
