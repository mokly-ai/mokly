//! Real Git creates a valid temporary index from an absent path.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Output, ReporterExecutorMock};
use crate::remote::error::Result;
use crate::remote::git_adapter_support::Repository;
use crate::remote::identity::RunId;
use crate::remote::process::{Process, Request};
use crate::remote::snapshot::contracts::Snapshot;
use crate::remote::snapshot::filesystem::SystemSnapshotFiles;
use crate::remote::snapshot::system::SystemSnapshot;

/// Inspect the index path immediately before the real first Git write.
struct IndexObserver {
    /// Actual Git child execution.
    inner: Arc<dyn Process + Send + Sync>,
    /// Count the observed first tree-build request.
    checks: AtomicUsize,
}

impl Process for IndexObserver {
    fn execute(&self, request: &Request) -> Result<Output> {
        if request.args == ["read-tree", "HEAD"] {
            let index = request.git_index.as_ref().unwrap();
            assert!(
                !index.exists(),
                "Git must create the index instead of reading an empty file"
            );
            self.checks.fetch_add(1, Ordering::SeqCst);
        }
        self.inner.execute(request)
    }
}

/// The reserved run directory owns the name while Git creates the index bytes.
#[test]
fn git_creates_the_index_from_a_missing_path() {
    let repository = Repository::new();
    let process = Arc::new(IndexObserver {
        inner: repository.process.clone(),
        checks: AtomicUsize::new(0),
    });
    let snapshot = SystemSnapshot {
        process: process.clone(),
        files: Arc::new(SystemSnapshotFiles),
        reporter: Arc::new(
            Unimock::new(ReporterExecutorMock.each_call(matching!(_)).returns(()))
                .no_verify_in_drop(),
        ),
        workspace: repository.root.clone(),
    };
    let handle = snapshot
        .create(
            &RunId::new("20261006T120000Z", 46).unwrap(),
            &repository.head(),
        )
        .unwrap();
    assert_eq!(process.checks.load(Ordering::SeqCst), 1);
    repository.at(&handle.directory, &["status", "--porcelain"]);
    snapshot.remove(&handle).unwrap();
    assert!(!handle.index.exists());
    assert!(!handle.directory.exists());
}
