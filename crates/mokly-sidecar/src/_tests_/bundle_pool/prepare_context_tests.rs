//! A prepared bundle request starts its PostCSS context on its own worker before the seed.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, WriteOutcome};
use crate::error::{Error, RemoteCode, RequestCode, Result};
use crate::methods::{BundleRequest, Call, ModuleResolution};
use crate::pool::{Pool, SidecarPool};
use crate::postcss_preparation::{PostcssPreparation, PrepareContext};
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

use super::{Events, answer, hit, params, pool};

fn resolution() -> ModuleResolution {
    ModuleResolution {
        dependency_root: Some("/workspace".into()),
        conditions: vec!["style".into()],
        ..Default::default()
    }
}

fn bundle_request(preparation: bool) -> BundleRequest {
    let mut params = params();
    params.repository_roots = vec!["/workspace".into()];
    params.module_resolution = resolution();
    BundleRequest {
        params,
        capture: None,
        plan: None,
        preparation: preparation.then(|| PostcssPreparation {
            context: "attempt".into(),
            postcss: "postcss.config.mjs".into(),
        }),
    }
}

fn request(pool: &Pool, request: BundleRequest) -> results::Bundle {
    match pool.request(Call::Bundle(request)) {
        Ok(MethodResult::Bundle(result)) => *result,
        outcome => panic!("expected a bundle result, got {outcome:?}"),
    }
}

/// One stored hit; the read is an event, so its order beside the worker calls shows.
fn store(events: Events) -> Unimock {
    Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("load".into());
                hit("seed")
            })),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ))
}

/// Record each call, keep each `prepareContext` request, and reuse the stored seed.
fn recorder(
    events: Events,
    prepared: Arc<Mutex<Vec<PrepareContext>>>,
    reply: fn() -> Result<MethodResult>,
) -> Unimock {
    Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let event = match &request.call {
                    Call::PrepareContext(value) => {
                        prepared.lock().unwrap().push(value.clone());
                        "prepare".into()
                    }
                    Call::RestoreGeneration(value) => format!("restore:{}", value.generation),
                    Call::Dispose(value) => format!("dispose:{}", value.generation),
                    Call::Bundle(_) => "bundle".into(),
                    _ => panic!("unexpected call"),
                };
                events.lock().unwrap().push(event);
                match &request.call {
                    Call::PrepareContext(_) => reply(),
                    Call::Bundle(_) => Ok(answer("seed", 0)),
                    _ => Ok(MethodResult::Empty),
                }
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    ))
}

#[test]
fn a_prepared_bundle_starts_its_context_before_the_cache_read_and_the_seed() {
    let events: Events = Arc::default();
    let prepared = Arc::default();
    let pool = pool(
        store(events.clone()),
        recorder(events.clone(), Arc::clone(&prepared), || {
            Ok(MethodResult::Empty)
        }),
    );
    let result = request(&pool, bundle_request(true));
    assert_eq!(result.generation, "seed");
    assert_eq!(result.cache, Some(CacheOutcome::Hit));
    assert_eq!(
        *events.lock().unwrap(),
        [
            "prepare",
            "load",
            "restore:disk:seed",
            "bundle",
            "dispose:disk:seed"
        ]
    );
    assert_eq!(
        *prepared.lock().unwrap(),
        [PrepareContext {
            context: "attempt".into(),
            postcss: "postcss.config.mjs".into(),
            source_root: "/repo".into(),
            repository_roots: vec!["/workspace".into()],
            module_resolution: resolution(),
        }]
    );
}

#[test]
fn a_bundle_without_a_preparation_sends_no_prepare_context() {
    let events: Events = Arc::default();
    let prepared = Arc::default();
    let pool = pool(
        store(events.clone()),
        recorder(events.clone(), Arc::clone(&prepared), || {
            Ok(MethodResult::Empty)
        }),
    );
    assert_eq!(
        request(&pool, bundle_request(false)).cache,
        Some(CacheOutcome::Hit)
    );
    assert_eq!(
        *events.lock().unwrap(),
        ["load", "restore:disk:seed", "bundle", "dispose:disk:seed"]
    );
    assert_eq!(*prepared.lock().unwrap(), []);
}

#[test]
fn an_error_reply_to_prepare_context_leaves_the_bundle_result_unchanged() {
    let events: Events = Arc::default();
    let pool = pool(
        store(events.clone()),
        recorder(events.clone(), Arc::default(), || {
            Err(Error::Remote {
                code: RemoteCode::Request(RequestCode::BundleFailed),
                message: "fixture preparation failed".into(),
            })
        }),
    );
    let result = request(&pool, bundle_request(true));
    assert_eq!(result.generation, "seed");
    assert_eq!(result.cache, Some(CacheOutcome::Hit));
    assert_eq!(
        *events.lock().unwrap(),
        [
            "prepare",
            "load",
            "restore:disk:seed",
            "bundle",
            "dispose:disk:seed"
        ]
    );
    let state = pool.lock();
    let attempt = BTreeSet::from(["attempt".to_owned()]);
    assert_eq!(state.contexts, attempt);
    assert_eq!(state.slots[0].as_ref().unwrap().contexts, attempt);
    assert_eq!(state.slots.iter().flatten().count(), 2);
}

#[test]
fn a_worker_replaced_after_prepare_context_receives_it_again_before_the_bundle() {
    let events: Events = Arc::default();
    let (loaded, invalidated) = (events.clone(), events.clone());
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                loaded.lock().unwrap().push("load".into());
                hit("seed")
            })),
        BundleStoreMock::invalidate
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                invalidated.lock().unwrap().push("invalidate".into());
                WriteOutcome::Invalidated
            })),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Written),
    ));
    let original = events.clone();
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let (event, reply) = match &request.call {
                    Call::PrepareContext(_) => ("prepare:original", Ok(MethodResult::Empty)),
                    Call::RestoreGeneration(_) => ("restore:original", Err(Error::Crashed)),
                    _ => panic!("unexpected call"),
                };
                original.lock().unwrap().push(event.into());
                reply
            })),
        ControlMock::kill.some_call(matching!()).returns(Ok(())),
    ));
    let mut pool = pool(store, worker);
    let replaced = events.clone();
    Arc::get_mut(&mut pool).unwrap().factory = Arc::new(Unimock::new(
        FactoryMock::spawn
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let captured = replaced.clone();
                let replacement = Unimock::new((
                    WorkerMock::handshake
                        .some_call(matching!(_))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, request, _| {
                            let (event, reply) = match &request.call {
                                Call::PrepareContext(_) => {
                                    ("prepare:replacement", MethodResult::Empty)
                                }
                                Call::Bundle(_) => ("bundle:replacement", answer("fresh", 1)),
                                _ => panic!("unexpected call"),
                            };
                            captured.lock().unwrap().push(event.into());
                            Ok(reply)
                        })),
                    WorkerMock::resident_bytes
                        .some_call(matching!())
                        .returns(Ok(0)),
                ));
                Ok(Spawned {
                    worker: Box::new(replacement.clone()),
                    control: Arc::new(replacement),
                })
            })),
    ));
    let result = request(&pool, bundle_request(true));
    assert_eq!(result.generation, "fresh");
    assert_eq!(result.cache, Some(CacheOutcome::Damaged));
    assert_eq!(
        *events.lock().unwrap(),
        [
            "prepare:original",
            "load",
            "restore:original",
            "invalidate",
            "prepare:replacement",
            "bundle:replacement"
        ]
    );
    let state = pool.lock();
    let attempt = BTreeSet::from(["attempt".to_owned()]);
    assert_eq!(state.contexts, attempt);
    assert_eq!(state.slots[0].as_ref().unwrap().contexts, attempt);
    assert_eq!(state.affinity["attempt"].index, 0);
}
