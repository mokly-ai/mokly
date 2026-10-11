//! Real SystemSnapshot execution inside a re-exec Git-started environment.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{ClockSleepMock, InterruptRequestedMock, ReporterExecutorMock};
use crate::remote::git_identity::CommitSha;
use crate::remote::identity::RunId;
use crate::remote::process::SystemProcess;
use crate::remote::snapshot::contracts::Snapshot;
use crate::remote::snapshot::filesystem::SystemSnapshotFiles;
use crate::remote::snapshot::system::SystemSnapshot;

/// Snapshot files and parent state are checked without creating another repository here.
pub(super) fn exercise(work_tree: bool) {
    let workspace = PathBuf::from(env::var_os("MOKLY_XTASK_SNAPSHOT_CHECKOUT").unwrap());
    let git_directory = PathBuf::from(env::var_os("GIT_DIR").unwrap());
    assert!(git_directory.is_absolute());
    assert_eq!(env::var_os("GIT_WORK_TREE").is_some(), work_tree);
    if work_tree {
        assert_eq!(env::var_os("GIT_WORK_TREE").unwrap(), workspace.as_os_str());
    }
    let base = CommitSha::read(&env::var("MOKLY_XTASK_SNAPSHOT_BASE").unwrap()).unwrap();
    let snapshot = SystemSnapshot {
        process: Arc::new(SystemProcess {
            interrupt: Arc::new(
                Unimock::new(InterruptRequestedMock.each_call(matching!()).returns(false))
                    .no_verify_in_drop(),
            ),
            clock: Arc::new(
                Unimock::new(
                    ClockSleepMock
                        .each_call(matching!())
                        .answers(&|_| thread::yield_now()),
                )
                .no_verify_in_drop(),
            ),
            logs: Arc::new(Unimock::new(())),
        }),
        files: Arc::new(SystemSnapshotFiles),
        reporter: Arc::new(
            Unimock::new(ReporterExecutorMock.each_call(matching!(_)).returns(()))
                .no_verify_in_drop(),
        ),
        workspace: workspace.clone(),
    };
    let handle = snapshot
        .create(&RunId::new("20261009T120000Z", 47).unwrap(), &base)
        .unwrap();
    let contents: Vec<_> = [".gitignore", "m1", "unpushed", "staged"]
        .iter()
        .map(|name| {
            (
                fs::read(workspace.join(name)),
                fs::read(handle.directory.join(name)),
            )
        })
        .collect();
    snapshot.remove(&handle).unwrap();
    assert!(!handle.directory.exists());
    assert!(!handle.index.exists());
    for (expected, actual) in contents {
        assert_eq!(actual.unwrap(), expected.unwrap());
    }
    println!("snapshot held expected files");
}
