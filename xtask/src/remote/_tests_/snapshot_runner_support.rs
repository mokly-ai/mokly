//! Unimock event and input captures for snapshot runner phase order.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};
use crate::remote::snapshot::contracts::{
    Ownership, SnapshotCreateMock, SnapshotHandle, SnapshotRemoveMock,
};

use super::snapshot_runner_client::client;

/// A controlled outcome at one snapshot lifecycle boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Case {
    /// The pushed commit already equals HEAD.
    SameHead,
    /// The base is behind checkout HEAD.
    BehindHead,
    /// Origin has no shared history.
    NoBase,
    /// Snapshot creation returns a typed failure.
    BuildFailure,
    /// Checkout and snapshot fingerprints differ.
    Mismatch,
    /// An interrupt arrives while the non-cancellable build finishes.
    Interrupt,
    /// Identity writing returns an error before warmup.
    IdentityFailure,
    /// Identity writing panics before warmup.
    IdentityPanic,
    /// Removal returns an error after successful suites.
    RemoveFailure,
    /// Removal panics after successful suites.
    RemovePanic,
    /// A removal warning destination panics.
    WarningPanic,
    /// Fingerprint reading fails after snapshot construction.
    FingerprintFailure,
}

/// Injected boundaries and their observed event sequence.
pub(super) struct Fixture {
    /// Runner dependencies, all side effects mocked.
    pub(super) dependencies: Dependencies,
    /// Captured phase order and diagnostics.
    pub(super) events: Arc<Mutex<Vec<String>>>,
}

/// Keep captured event insertion independent of operation behavior.
pub(super) fn event(events: &Mutex<Vec<String>>, value: &str) {
    events.lock().unwrap().push(value.to_owned());
}

/// Controlled typed operating-system failure, never an actual filesystem call.
fn failure(operation: Operation) -> Error {
    Error::Io {
        operation,
        source: std::io::Error::other("snapshot test failure"),
    }
}

/// A pure valid mock process result.
pub(super) fn output(stdout: String) -> Output {
    Output {
        stdout,
        code: Some(0),
        ..Output::default()
    }
}

/// Compose phase-specific behavior with captured inputs and no real clocks or children.
pub(super) fn fixture(case: Case) -> Fixture {
    let events = Arc::new(Mutex::new(Vec::new()));
    let interrupted = Arc::new(AtomicBool::new(false));
    let head = CommitSha::read(&"b".repeat(40)).unwrap();
    let base = BaseCommit {
        sha: if case == Case::BehindHead {
            CommitSha::read(&"d".repeat(40)).unwrap()
        } else {
            head.clone()
        },
        ahead: if case == Case::BehindHead { 3 } else { 0 },
    };
    let base_sha = base.sha.clone();
    let root = PathBuf::from("/workspace");
    let directory = root.join(".context/verification-snapshots/20261006T120000Z-42");
    let head_events = events.clone();
    let base_events = events.clone();
    let signal = interrupted.clone();
    let core = Arc::new(
        Unimock::new((
            GitHeadMock
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    event(&head_events, "head");
                    Ok(head.clone())
                })),
            GitBaseMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, head| {
                    assert_eq!(head.as_str(), "b".repeat(40));
                    event(&base_events, "base");
                    Ok(if case == Case::NoBase {
                        BaseLookup::NoBase
                    } else {
                        BaseLookup::Found(base.clone())
                    })
                })),
            EnvironmentGetMock.each_call(matching!(_)).returns(None),
            EnvironmentPidMock.each_call(matching!()).returns(42u32),
            ClockStampMock
                .each_call(matching!())
                .returns("20261006T120000Z".to_owned()),
            ClockMillisMock.each_call(matching!()).returns(1000u128),
            ProgramsFindMock
                .each_call(matching!("gh"))
                .answers(&|_, _| Ok(false)),
            InterruptRequestedMock
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| signal.load(Ordering::SeqCst))),
        ))
        .no_verify_in_drop(),
    );
    let create_events = events.clone();
    let remove_events = events.clone();
    let snapshot = Arc::new(
        Unimock::new((
            SnapshotCreateMock
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, run, base| {
                    event(&create_events, "create");
                    assert_eq!(run.as_str(), "20261006T120000Z-42");
                    assert_eq!(base, &base_sha);
                    if case == Case::BuildFailure {
                        return Err(failure(Operation::Snapshot));
                    }
                    if case == Case::Interrupt {
                        interrupted.store(true, Ordering::SeqCst);
                    }
                    let mut handle = SnapshotHandle::paths(Path::new("/workspace"), run);
                    handle.ownership = Ownership::Linked;
                    Ok(handle)
                })),
            SnapshotRemoveMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, handle| {
                    event(&remove_events, "remove");
                    assert_eq!(handle.directory, directory);
                    if case == Case::RemovePanic {
                        panic!("snapshot removal boundary panics");
                    }
                    if matches!(case, Case::RemoveFailure | Case::WarningPanic) {
                        return Err(failure(Operation::Snapshot));
                    }
                    Ok(())
                })),
        ))
        .no_verify_in_drop(),
    );
    let fingerprint_events = events.clone();
    let aggregate_events = events.clone();
    let scripts = Arc::new(
        Unimock::new((
            FingerprintReadMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, cwd| {
                    event(
                        &fingerprint_events,
                        &format!("fingerprint:{}", cwd.display()),
                    );
                    if case == Case::FingerprintFailure {
                        return Err(failure(Operation::Fingerprint));
                    }
                    let snapshot = cwd != Path::new("/workspace");
                    Ok(format!(
                        "sha256:{}",
                        if snapshot && case == Case::Mismatch {
                            "c".repeat(64)
                        } else {
                            "a".repeat(64)
                        }
                    ))
                })),
            AggregateValidateMock
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, reports, base| {
                    assert_eq!(
                        reports,
                        Path::new(
                            "/workspace/.context/verification-reports/remote/20261006T120000Z-42"
                        )
                    );
                    assert_eq!(
                        base,
                        if case == Case::BehindHead {
                            "d".repeat(40)
                        } else {
                            "b".repeat(40)
                        }
                    );
                    event(&aggregate_events, "aggregate");
                    Ok(())
                })),
        ))
        .no_verify_in_drop(),
    );
    let identity_events = events.clone();
    let logs = Arc::new(
        Unimock::new((
            LogsPrepareMock
                .each_call(matching!(_))
                .answers(&|_, _| Ok(())),
            LogsWriteIdentityMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, identity| {
                    event(&identity_events, &format!("identity:{}", identity.json()));
                    if case == Case::IdentityPanic {
                        panic!("identity writer panics");
                    }
                    if case == Case::IdentityFailure {
                        return Err(failure(Operation::Logs));
                    }
                    Ok(())
                })),
        ))
        .no_verify_in_drop(),
    );
    let blacksmith = client(case, events.clone());
    let report_events = events.clone();
    let progress_events = events.clone();
    let reporter = Arc::new(
        Unimock::new((
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    event(&report_events, &format!("message:{message}"));
                    if case == Case::WarningPanic && message.contains("snapshot cleanup failed") {
                        panic!("warning output panics");
                    }
                })),
            ReporterProgressMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    event(&progress_events, &format!("progress:{message}"));
                })),
        ))
        .no_verify_in_drop(),
    );
    Fixture {
        dependencies: Dependencies {
            environment: core.clone(),
            programs: core.clone(),
            clock: core.clone(),
            git: core.clone(),
            snapshot,
            blacksmith,
            github: Arc::new(Unimock::new(())),
            fingerprint: scripts.clone(),
            aggregate: scripts,
            logs,
            interrupt: core,
            reporter,
            workspace: root,
        },
        events,
    }
}
