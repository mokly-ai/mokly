//! Each failure of `prepareContext` takes the recovery of its error kind.

use std::collections::BTreeSet;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::error::{Error, RemoteCode, RequestCode, Result};
use crate::methods::Call;
use crate::pool::SidecarPool;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

use super::prepare_context_tests::{bundle_request, store};
use super::{Events, answer, pool};

/// The result of the request, with the expected error as its own value.
#[derive(Debug, PartialEq)]
enum Outcome {
    /// A bundle result with its generation and cache outcome.
    Bundle(String, Option<CacheOutcome>),
    /// A `sidecar-protocol` error reply.
    Protocol,
    /// Any other result, for the failure output only.
    Other(String),
}

impl Outcome {
    fn of(result: Result<MethodResult>) -> Self {
        match result {
            Ok(MethodResult::Bundle(bundle)) => Self::Bundle(bundle.generation, bundle.cache),
            Err(Error::Remote {
                code: RemoteCode::Request(RequestCode::SidecarProtocol),
                ..
            }) => Self::Protocol,
            other => Self::Other(format!("{other:?}")),
        }
    }
}

/// The calls, kills, and spawns of one request in their order, and the pool state after it.
#[derive(Debug, PartialEq)]
struct Observed {
    row: &'static str,
    events: Vec<String>,
    outcome: Outcome,
    contexts: BTreeSet<String>,
    slot: Option<BTreeSet<String>>,
    slots: usize,
}

struct Row {
    name: &'static str,
    reply: fn() -> Result<MethodResult>,
    events: &'static [&'static str],
    outcome: Outcome,
    kept: bool,
    slots: usize,
}

impl Row {
    fn expected(self) -> Observed {
        let attempt = BTreeSet::from(["attempt".to_owned()]);
        Observed {
            row: self.name,
            events: self.events.iter().map(ToString::to_string).collect(),
            outcome: self.outcome,
            contexts: attempt.clone(),
            slot: self.kept.then_some(attempt),
            slots: self.slots,
        }
    }
}

/// A worker that records each call and its kill under `name` and answers `prepareContext` with `reply`.
///
/// Each row uses another subset of the methods. The event list checks every call, so the mocks of
/// this file do not verify their calls on drop.
fn worker(name: &'static str, events: Events, reply: fn() -> Result<MethodResult>) -> Unimock {
    let killed = events.clone();
    Unimock::new((
        WorkerMock::handshake
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                events
                    .lock()
                    .unwrap()
                    .push(format!("{name}: {}", request.call));
                match &request.call {
                    Call::PrepareContext(_) => reply(),
                    Call::Bundle(_) => Ok(answer("seed", 0)),
                    _ => Ok(MethodResult::Empty),
                }
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
        ControlMock::kill
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                killed.lock().unwrap().push(format!("{name}: kill"));
                Ok(())
            })),
    ))
    .no_verify_in_drop()
}

/// Send one prepared bundle request with a stored hit; a spawn starts the `replacement` worker.
fn observe(row: &Row) -> Observed {
    let events: Events = Arc::default();
    let mut pool = pool(
        store(events.clone()).no_verify_in_drop(),
        worker("first", events.clone(), row.reply),
    );
    let spawned = events.clone();
    Arc::get_mut(&mut pool).unwrap().factory = Arc::new(
        Unimock::new(
            FactoryMock::spawn
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    spawned.lock().unwrap().push("spawn".into());
                    let replacement =
                        worker("replacement", spawned.clone(), || Ok(MethodResult::Empty));
                    Ok(Spawned {
                        worker: Box::new(replacement.clone()),
                        control: Arc::new(replacement),
                    })
                })),
        )
        .no_verify_in_drop(),
    );
    let outcome = Outcome::of(pool.request(Call::Bundle(bundle_request(true))));
    let state = pool.lock();
    Observed {
        row: row.name,
        events: events.lock().unwrap().clone(),
        outcome,
        contexts: state.contexts.clone(),
        slot: state.slots[0].as_ref().map(|slot| slot.contexts.clone()),
        slots: state.slots.iter().flatten().count(),
    }
}

const REPLACED: &[&str] = &[
    "first: prepareContext attempt",
    "first: kill",
    "spawn",
    "replacement: prepareContext attempt",
    "load",
    "replacement: restoreGeneration disk:seed",
    "replacement: bundle",
    "replacement: dispose disk:seed",
];

#[test]
fn each_prepare_context_failure_takes_the_recovery_of_its_error_kind() {
    let rows = [
        Row {
            name: "crash",
            reply: || Err(Error::Crashed),
            events: REPLACED,
            outcome: Outcome::Bundle("seed".into(), Some(CacheOutcome::Hit)),
            kept: true,
            slots: 2,
        },
        Row {
            name: "timeout",
            reply: || {
                Err(Error::Timeout {
                    deadline_ms: 30_000,
                    phase: None,
                })
            },
            events: REPLACED,
            outcome: Outcome::Bundle("seed".into(), Some(CacheOutcome::Hit)),
            kept: true,
            slots: 2,
        },
        Row {
            name: "protocol reply",
            reply: || {
                Err(Error::Remote {
                    code: RemoteCode::Request(RequestCode::SidecarProtocol),
                    message: "fixture protocol failure".into(),
                })
            },
            events: &["first: prepareContext attempt", "first: kill"],
            outcome: Outcome::Protocol,
            kept: false,
            slots: 1,
        },
        Row {
            name: "usable error reply",
            reply: || {
                Err(Error::Remote {
                    code: RemoteCode::Request(RequestCode::BundleFailed),
                    message: "fixture preparation failed".into(),
                })
            },
            events: &[
                "first: prepareContext attempt",
                "load",
                "first: restoreGeneration disk:seed",
                "first: bundle",
                "first: dispose disk:seed",
            ],
            outcome: Outcome::Bundle("seed".into(), Some(CacheOutcome::Hit)),
            kept: true,
            slots: 2,
        },
    ];
    let mismatches: Vec<(Observed, Observed)> = rows
        .into_iter()
        .map(|row| (observe(&row), row.expected()))
        .filter(|(observed, expected)| observed != expected)
        .collect();
    assert_eq!(
        mismatches,
        Vec::new(),
        "pairs of observed and expected rows"
    );
}
