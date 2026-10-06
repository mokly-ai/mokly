//! Preparation boundary failures cannot allocate a box.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::runner::{DefaultRemoteRunner, RemoteRunner};

fn failure(operation: Operation) -> Error {
    Error::Io {
        operation,
        source: std::io::Error::other("test failure"),
    }
}

#[test]
fn head_fingerprint_and_log_failures_stop_before_warmup() {
    for stage in 0..3 {
        let environment = Arc::new(if stage == 2 {
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
            ReporterExecutorMock.next_call(matching!(_)).returns(()),
            BlacksmithListMock
                .next_call(matching!())
                .answers(&|_| Ok(())),
            GitPublishedMock
                .next_call(matching!())
                .answers(&|_| Ok(true)),
            InterruptRequestedMock.next_call(matching!()).returns(false),
            GitHeadMock
                .next_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    if stage == 0 {
                        Err(failure(Operation::Git))
                    } else {
                        Ok("b".repeat(40))
                    }
                })),
        )));
        let fingerprint = Arc::new(if stage == 0 {
            Unimock::new(())
        } else {
            Unimock::new(
                FingerprintReadMock
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        if stage == 1 {
                            Err(failure(Operation::Fingerprint))
                        } else {
                            Ok(format!("sha256:{}", "a".repeat(64)))
                        }
                    })),
            )
        });
        let clock = Arc::new(if stage == 2 {
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
        let unused = Arc::new(Unimock::new(()));
        let result = DefaultRemoteRunner {
            dependencies: Dependencies {
                environment,
                programs: shared.clone(),
                clock,
                git: shared.clone(),
                blacksmith: shared.clone(),
                github: unused.clone(),
                fingerprint,
                aggregate: unused,
                logs,
                interrupt: shared.clone(),
                reporter: shared,
                workspace: PathBuf::from("/workspace"),
            },
        }
        .run();
        assert!(matches!(result, Err(Error::Io { .. })));
    }
}
