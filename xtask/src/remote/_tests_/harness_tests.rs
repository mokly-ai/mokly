//! Unimock fixtures with phase-specific expected calls.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::executor::Executor;
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

use super::harness_client_tests::client;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Case {
    Success,
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
            .answers(&|_| Ok("b".repeat(40))),
        GitPublishedMock
            .each_call(matching!())
            .answers(&|_| Ok(true)),
        FingerprintReadMock
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let read = reads.fetch_add(1, Ordering::SeqCst);
                Ok(format!(
                    "sha256:{}",
                    if read > 0 && case == Case::ChangedTree {
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
    let stamp = ClockStampMock
        .each_call(matching!())
        .returns("20261006T120000Z".to_owned());
    let clock = Arc::new(if case.preparation_fails() {
        Unimock::new(stamp)
    } else {
        Unimock::new((
            stamp,
            ClockMillisMock.each_call(matching!()).returns(1000u128),
        ))
    });
    let prepare = LogsPrepareMock
        .each_call(matching!("20261006T120000Z-42"))
        .answers(&|_, _| Ok(()));
    let logs = Arc::new(if case == Case::Suite {
        Unimock::new((
            prepare,
            LogsTailMock
                .each_call(matching!(_))
                .answers(&|_, _| Ok("failed command tail".into())),
        ))
    } else {
        Unimock::new(prepare)
    });
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
                    print_events.lock().unwrap().push(format!("message:{line}"));
                })),
        )))
    };
    let cancel_events = events.clone();
    let github = Arc::new(if case == Case::MissingRun {
        Unimock::new(())
    } else {
        Unimock::new(
            GithubCancelMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, id| {
                    cancel_events.lock().unwrap().push(format!("cancel:{id}"));
                    if case == Case::Cancel {
                        return Err(Error::Command {
                            operation: Operation::Github,
                            code: Some(1),
                        });
                    }
                    Ok(())
                })),
        )
    });
    let aggregate_events = events.clone();
    let aggregate = Arc::new(
        if case.preparation_fails() || case == Case::InterruptSuites {
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
                            });
                        }
                        Ok(())
                    })),
            )
        },
    );
    let fixture = Harness {
        events,
        dependencies: Dependencies {
            environment: shared.clone(),
            programs: shared.clone(),
            clock,
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
