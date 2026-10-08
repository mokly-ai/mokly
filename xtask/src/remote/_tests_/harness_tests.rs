//! Unimock fixtures with phase-specific expected calls.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::executor::Executor;
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};

use super::harness_client_tests::client;
use super::harness_clock_tests::clock;
use super::harness_github_tests::github;
use super::harness_snapshot_tests::snapshot;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Case {
    Success,
    PanicSuites,
    Warmup,
    CleanupWarmup,
    MultipleIds,
    RepeatedBox,
    NoId,
    Probe,
    Head,
    Fingerprint,
    Suite,
    Download,
    Aggregate,
    ChangedTree,
    InterruptWarmup,
    InterruptSuites,
    Cancel,
    MissingRun,
    RetryStop,
    CleanupSuites,
    CleanupFailedSuite,
    CompletedOnRetry,
    InterruptCleanupWarmup,
    InterruptCleanupSuites,
    WarmupRunId,
    WarmupRunIdFailure,
    ProbeRunId,
    ProbeRunIdFailure,
    CancelCompleted,
    CancelReadFailure,
    LogUnavailable,
    StatusRunId,
    CompletedOnFinal,
}

impl Case {
    pub(super) fn preparation_fails(self) -> bool {
        matches!(
            self,
            Self::Warmup
                | Self::CleanupWarmup
                | Self::MultipleIds
                | Self::RepeatedBox
                | Self::NoId
                | Self::Probe
                | Self::Head
                | Self::Fingerprint
                | Self::InterruptWarmup
                | Self::InterruptCleanupWarmup
                | Self::WarmupRunIdFailure
                | Self::ProbeRunIdFailure
        )
    }
}

pub(super) struct Harness {
    pub(super) dependencies: Dependencies,
    pub(super) events: Arc<Mutex<Vec<String>>>,
}

pub(super) fn output(text: String, code: i32) -> Output {
    Output {
        stdout: text,
        stderr: String::new(),
        code: Some(code),
    }
}

pub(super) fn harness(case: Case) -> Harness {
    let events = Arc::new(Mutex::new(Vec::new()));
    let interrupted = Arc::new(AtomicBool::new(false));
    let blacksmith = Arc::new(client(case, events.clone(), interrupted.clone()));
    let reads = Arc::new(AtomicUsize::new(0));
    let shared = Arc::new(Unimock::new((
        EnvironmentGetMock
            .each_call(matching!(_))
            .answers(&|_, name| match name {
                "MOKLY_TESTBOX_REF" => Some("feature".into()),
                _ => None,
            }),
        EnvironmentPidMock.each_call(matching!()).returns(42u32),
        ProgramsFindMock
            .each_call(matching!(_))
            .answers(&|_, _| Ok(true)),
        GitHeadMock
            .each_call(matching!())
            .answers(&|_| CommitSha::read(&"b".repeat(40))),
        GitPublishedMock
            .each_call(matching!())
            .answers(&|_| Ok(true)),
        GitBaseMock.each_call(matching!(_)).answers(&|_, head| {
            Ok(BaseLookup::Found(BaseCommit {
                sha: head.clone(),
                ahead: 0,
            }))
        }),
        FingerprintReadMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _cwd| {
                let read = reads.fetch_add(1, Ordering::SeqCst);
                Ok(format!(
                    "sha256:{}",
                    if read > 1 && case == Case::ChangedTree {
                        "c".repeat(64)
                    } else {
                        "a".repeat(64)
                    }
                ))
            })),
        InterruptRequestedMock
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| interrupted.load(Ordering::SeqCst))),
    )));
    let clock = clock(case, events.clone());
    let prepare = LogsPrepareMock
        .each_call(matching!("20261006T120000Z-42"))
        .answers(&|_, _| Ok(()));
    let identity = LogsWriteIdentityMock
        .each_call(matching!(_))
        .answers(&|_, _| Ok(()));
    let logs = Arc::new(
        if matches!(
            case,
            Case::Suite | Case::LogUnavailable | Case::CleanupFailedSuite
        ) {
            Unimock::new((
                prepare,
                identity,
                LogsTailMock
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        if case == Case::LogUnavailable {
                            Err(Error::Command {
                                operation: Operation::Logs,
                                code: Some(1),
                                detail: None,
                            })
                        } else {
                            Ok("failed command tail".into())
                        }
                    })),
            ))
        } else {
            Unimock::new((prepare, identity))
        },
    );
    let progress_events = events.clone();
    let progress = ReporterProgressMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, line| {
            progress_events
                .lock()
                .unwrap()
                .push(format!("progress:{line}"));
        }));
    let reporter = if case.preparation_fails() {
        let print_events = events.clone();
        Arc::new(Unimock::new(
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, line| {
                    print_events.lock().unwrap().push(format!("message:{line}"));
                })),
        ))
    } else {
        let print_events = events.clone();
        Arc::new(Unimock::new((
            progress,
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, line| {
                    if case == Case::PanicSuites
                        && (line.contains("suite worker failed") || std::thread::panicking())
                    {
                        panic!("reporter panics during suite recovery and cleanup");
                    }
                    print_events.lock().unwrap().push(format!("message:{line}"));
                })),
        )))
    };
    let github = github(case, events.clone());
    let aggregate_events = events.clone();
    let aggregate = Arc::new(
        if case.preparation_fails()
            || matches!(
                case,
                Case::InterruptSuites | Case::InterruptCleanupSuites | Case::PanicSuites
            )
        {
            Unimock::new(())
        } else {
            Unimock::new(
                AggregateValidateMock
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, path, head| {
                        aggregate_events.lock().unwrap().push("aggregate".into());
                        assert_eq!(head, "b".repeat(40));
                        assert!(path.to_string_lossy().ends_with("20261006T120000Z-42"));
                        if case == Case::Aggregate {
                            return Err(Error::Command {
                                operation: Operation::Aggregate,
                                code: Some(1),
                                detail: None,
                            });
                        }
                        Ok(())
                    })),
            )
        },
    );
    let snapshot = snapshot(events.clone());
    let fixture = Harness {
        events,
        dependencies: Dependencies {
            environment: shared.clone(),
            programs: shared.clone(),
            clock,
            snapshot,
            git: shared.clone(),
            blacksmith,
            github,
            fingerprint: shared.clone(),
            aggregate,
            logs,
            interrupt: shared,
            reporter,
            workspace: PathBuf::from("/workspace"),
        },
    };
    DefaultSelector {
        dependencies: fixture.dependencies.clone(),
    }
    .select(Executor::Remote)
    .unwrap();
    fixture
}
