//! Unit-test partial snapshot ownership and cleanup with injected boundaries.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;

use crate::remote::error::Error;
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::snapshot::contracts::{Ownership, Snapshot, SnapshotHandle};

use self::system_support::{Case, fixture};

#[path = "system_support.rs"]
mod system_support;

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
                ["parent", "absent", "absent", "directory", "absent"]
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
