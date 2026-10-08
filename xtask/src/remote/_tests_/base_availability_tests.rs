//! Typed origin-base availability and exact diagnostic behavior without boxes.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::executor::{Decision, Executor};
use crate::remote::availability::{DefaultSelector, Selector};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};

/// Controlled Git-boundary result after successful Blacksmith access.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Case {
    /// A published ancestor accepts unpushed checkout commits.
    Behind,
    /// No origin ref shares history with the checkout.
    NoBase,
    /// Reading checkout HEAD failed.
    HeadFailure,
    /// Looking up the pushed ancestor failed.
    BaseFailure,
}

/// Keep command errors typed so the selector cannot decide from their text.
fn failure() -> Error {
    Error::Command {
        operation: Operation::Git,
        code: Some(128),
        detail: None,
    }
}

/// Availability collaborators and their captured operation and output streams.
struct Fixture {
    /// Selector under test.
    selector: DefaultSelector,
    /// Observed Git reads.
    events: Arc<Mutex<Vec<String>>>,
    /// Captured version and warning lines.
    messages: Arc<Mutex<Vec<String>>>,
}

/// Compose availability-only mocks without real children or filesystem access.
fn fixture(case: Case) -> Fixture {
    let events = Arc::new(Mutex::new(Vec::new()));
    let messages = Arc::new(Mutex::new(Vec::new()));
    let heads = events.clone();
    let bases = events.clone();
    let output = messages.clone();
    let shared = Arc::new(
        Unimock::new((
            EnvironmentGetMock
                .each_call(matching!(_))
                .answers(&|_, name| {
                    (name == "BLACKSMITH_ORG_TOKEN").then(|| "test-key".to_owned())
                }),
            ProgramsFindMock
                .each_call(matching!(_))
                .answers(&|_, _| Ok(true)),
            BlacksmithVersionMock
                .each_call(matching!())
                .answers(&|_| Ok("test version".into())),
            BlacksmithLoginMock
                .each_call(matching!("test-key"))
                .answers(&|_, _| Ok(())),
            BlacksmithListMock
                .each_call(matching!())
                .answers(&|_| Ok(())),
            GitHeadMock
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    heads.lock().unwrap().push("head".into());
                    if case == Case::HeadFailure {
                        Err(failure())
                    } else {
                        CommitSha::read(&"b".repeat(40))
                    }
                })),
            GitBaseMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, head| {
                    assert_eq!(head.as_str(), "b".repeat(40));
                    bases.lock().unwrap().push("base".into());
                    match case {
                        Case::NoBase => Ok(BaseLookup::NoBase),
                        Case::BaseFailure => Err(failure()),
                        _ => Ok(BaseLookup::Found(BaseCommit {
                            sha: CommitSha::read(&"a".repeat(40)).unwrap(),
                            ahead: 5,
                        })),
                    }
                })),
            InterruptRequestedMock.each_call(matching!()).returns(false),
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    output.lock().unwrap().push(message.to_owned());
                })),
        ))
        .no_verify_in_drop(),
    );
    let unused = Arc::new(Unimock::new(()));
    Fixture {
        selector: DefaultSelector {
            dependencies: Dependencies {
                environment: shared.clone(),
                programs: shared.clone(),
                clock: unused.clone(),
                git: shared.clone(),
                snapshot: unused.clone(),
                blacksmith: shared.clone(),
                github: unused.clone(),
                fingerprint: unused.clone(),
                aggregate: unused.clone(),
                logs: unused,
                interrupt: shared.clone(),
                reporter: shared,
                workspace: PathBuf::from("/workspace"),
            },
        },
        events,
        messages,
    }
}

/// Both modes accept a pushed ancestor without creating snapshots or warming boxes.
#[test]
fn a_base_behind_head_selects_remote_and_prints_the_new_decision() {
    for mode in [Executor::Auto, Executor::Remote] {
        let Fixture {
            selector, events, ..
        } = fixture(Case::Behind);
        let decision = selector.select(mode).unwrap();
        assert_eq!(decision, Decision::Remote);
        assert_eq!(*events.lock().unwrap(), ["head", "base"]);
        assert_eq!(
            decision.to_string(),
            "remote: Blacksmith access and a pushed base commit are available"
        );
    }
}

/// Automatic no-base fallback emits one warning with the exact recovery instruction.
#[test]
fn no_base_auto_emits_one_warning_and_the_defined_local_reason() {
    let Fixture {
        selector,
        events,
        messages,
    } = fixture(Case::NoBase);
    let decision = selector.select(Executor::Auto).unwrap();
    assert!(matches!(decision, Decision::Local(_)));
    assert_eq!(
        decision.to_string(),
        "local: a pushed base commit is unavailable"
    );
    assert_eq!(*events.lock().unwrap(), ["head", "base"]);
    let messages = messages.lock().unwrap();
    assert_eq!(messages.iter().filter(|line| line.starts_with("warning:")).collect::<Vec<_>>(),
        [&"warning: [xtask/remote] no origin ref shares history with HEAD; fetch origin or push the branch".to_owned()]);
}

/// Explicit remote no-base requests return their existing typed preparation error.
#[test]
fn no_base_explicit_remote_returns_the_typed_error() {
    let Fixture {
        selector, messages, ..
    } = fixture(Case::NoBase);
    assert!(matches!(
        selector.select(Executor::Remote),
        Err(Error::NoBase)
    ));
    assert!(
        !messages
            .lock()
            .unwrap()
            .iter()
            .any(|line| line.starts_with("warning:"))
    );
}

/// Failed HEAD and base commands follow the same automatic and explicit row rules.
#[test]
fn git_read_failures_fall_back_only_in_auto() {
    for case in [Case::HeadFailure, Case::BaseFailure] {
        for mode in [Executor::Auto, Executor::Remote] {
            let Fixture {
                selector,
                events,
                messages,
            } = fixture(case);
            let result = selector.select(mode);
            if mode == Executor::Auto {
                assert!(matches!(result, Ok(Decision::Local(_))));
            } else {
                assert!(matches!(
                    result,
                    Err(Error::Command {
                        operation: Operation::Git,
                        code: Some(128),
                        ..
                    })
                ));
            }
            assert_eq!(
                *events.lock().unwrap(),
                if case == Case::HeadFailure {
                    vec!["head"]
                } else {
                    vec!["head", "base"]
                }
            );
            assert_eq!(
                messages
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|line| line.starts_with("warning:"))
                    .count(),
                usize::from(mode == Executor::Auto)
            );
        }
    }
}
