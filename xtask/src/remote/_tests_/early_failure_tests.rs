//! Preparation boundary failures cannot allocate a box.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::check::request::DependencyAudit;
use crate::executor::Executor;
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};
use crate::remote::runner::{DefaultRemoteRunner, Failure, RemoteRunner};
use crate::remote::snapshot::contracts::{
    Ownership, SnapshotCreateMock, SnapshotHandle, SnapshotRemoveMock,
};

/// Preserve the operation identity without performing any I/O.
fn failure(operation: Operation) -> Error {
    Error::Io {
        operation,
        source: std::io::Error::other("test failure"),
    }
}

/// HEAD, source and log failures remain typed preparation failures with no warmup.
#[test]
fn head_fingerprint_and_log_failures_stop_before_warmup() {
    for stage in 0..3 {
        let environment = Arc::new(if stage > 0 {
            Unimock::new((
                EnvironmentGetMock.each_call(matching!(_)).returns(None),
                EnvironmentPidMock.next_call(matching!()).returns(42u32),
            ))
        } else {
            Unimock::new(EnvironmentGetMock.each_call(matching!(_)).returns(None))
        });
        let shared = Arc::new(Unimock::new((
            ProgramsFindMock
                .each_call(matching!(_))
                .answers(&|_, _| Ok(true)),
            BlacksmithVersionMock
                .next_call(matching!())
                .answers(&|_| Ok("test version".into())),
            ReporterExecutorMock.each_call(matching!(_)).returns(()),
            BlacksmithListMock
                .next_call(matching!())
                .answers(&|_| Ok(())),
            InterruptRequestedMock.each_call(matching!()).returns(false),
        )));
        let reads = AtomicUsize::new(0);
        let git = Arc::new(Unimock::new((
            GitHeadMock
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let read = reads.fetch_add(1, Ordering::SeqCst);
                    if stage == 0 && read > 0 {
                        Err(failure(Operation::Git))
                    } else {
                        CommitSha::read(&"b".repeat(40))
                    }
                })),
            GitBaseMock.each_call(matching!(_)).answers(&|_, head| {
                Ok(BaseLookup::Found(BaseCommit {
                    sha: head.clone(),
                    ahead: 0,
                }))
            }),
        )));
        let fingerprint = Arc::new(if stage == 0 {
            Unimock::new(())
        } else {
            Unimock::new(
                FingerprintReadMock
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        if stage == 1 {
                            Err(failure(Operation::Fingerprint))
                        } else {
                            Ok(format!("sha256:{}", "a".repeat(64)))
                        }
                    })),
            )
        });
        let clock = Arc::new(if stage > 0 {
            Unimock::new(
                ClockStampMock
                    .next_call(matching!())
                    .returns("20261006T120000Z".to_owned()),
            )
        } else {
            Unimock::new(())
        });
        let logs = Arc::new(if stage == 2 {
            Unimock::new(
                LogsPrepareMock
                    .next_call(matching!("20261006T120000Z-42"))
                    .answers(&|_, _| Err(failure(Operation::Logs))),
            )
        } else {
            Unimock::new(())
        });
        let snapshot = Arc::new(if stage == 0 {
            Unimock::new(())
        } else {
            Unimock::new((
                SnapshotCreateMock
                    .next_call(matching!(_, _))
                    .answers(&|_, run, _| {
                        let mut handle = SnapshotHandle::paths(&PathBuf::from("/workspace"), run);
                        handle.ownership = Ownership::Linked;
                        Ok(handle)
                    }),
                SnapshotRemoveMock
                    .next_call(matching!(_))
                    .answers(&|_, _| Ok(())),
            ))
        });
        let unused = Arc::new(Unimock::new(()));
        let runner = DefaultRemoteRunner {
            dependencies: Dependencies {
                environment,
                programs: shared.clone(),
                clock,
                git,
                snapshot,
                blacksmith: shared.clone(),
                github: unused.clone(),
                fingerprint,
                aggregate: unused,
                logs,
                interrupt: shared.clone(),
                reporter: shared,
                workspace: PathBuf::from("/workspace"),
            },
        };
        DefaultSelector {
            dependencies: runner.dependencies.clone(),
        }
        .select(Executor::Remote)
        .unwrap();
        assert!(matches!(
            runner.run(DependencyAudit::Baseline),
            Err(Failure::Unavailable(Error::Io { .. }))
        ));
    }
}
