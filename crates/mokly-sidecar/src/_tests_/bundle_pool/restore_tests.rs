//! Rejected optional restores become misses without another product-request retry.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, RecordToken, WriteOutcome};
use crate::error::{Error, RemoteCode, RequestCode};
use crate::methods::Call;
use crate::pool::SidecarPool;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

use super::{answer, bundle, hit, params, pool};

#[test]
fn rejected_restore_retires_only_its_token_then_bundles_once() {
    let events = Arc::new(Mutex::new(vec![]));
    let invalidated = events.clone();
    let saved = events.clone();
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(hit("seed")),
        BundleStoreMock::invalidate
            .some_call(matching!((_, token) if **token == RecordToken::new([7; 32])))
            .answers_arc(Arc::new(move |_, _, _| {
                invalidated.lock().unwrap().push("invalidate");
                WriteOutcome::Invalidated
            })),
        BundleStoreMock::save
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                saved.lock().unwrap().push("save");
                WriteOutcome::Written
            })),
    ));
    let requested = events.clone();
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| match request.call {
                Call::RestoreGeneration(_) => {
                    requested.lock().unwrap().push("restore");
                    Err(Error::Remote {
                        code: RemoteCode::Request(RequestCode::BundleFailed),
                        message: "rejected".into(),
                    })
                }
                Call::Bundle(_) => {
                    requested.lock().unwrap().push("bundle");
                    Ok(answer("fresh"))
                }
                _ => panic!("unexpected call"),
            })),
        WorkerMock::resident_bytes
            .some_call(matching!())
            .returns(Ok(0)),
    ));
    let pool = pool(store, worker);
    let result = bundle(&pool);
    assert_eq!(result.cache, Some(CacheOutcome::Damaged));
    assert_eq!(result.generation, "fresh");
    assert_eq!(
        *events.lock().unwrap(),
        ["restore", "invalidate", "bundle", "save"]
    );
    assert!(
        !pool.lock().slots[0]
            .as_ref()
            .unwrap()
            .generations
            .contains_key("disk:seed")
    );
}

#[test]
fn disk_transport_failure_uses_existing_recovery_without_loading_the_seed_again() {
    let events = Arc::new(Mutex::new(vec![]));
    let loaded = events.clone();
    let invalidated = events.clone();
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                loaded.lock().unwrap().push("load");
                hit("seed")
            })),
        BundleStoreMock::invalidate
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                invalidated.lock().unwrap().push("invalidate");
                WriteOutcome::Invalidated
            })),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Written),
    ));
    let broken = events.clone();
    let worker = Unimock::new((
        WorkerMock::request
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                broken.lock().unwrap().push("restore-failed");
                Err(Error::Crashed)
            })),
        ControlMock::kill.some_call(matching!()).returns(Ok(())),
    ));
    let mut pool = pool(store, worker);
    let recovered = events.clone();
    Arc::get_mut(&mut pool).unwrap().factory = Arc::new(Unimock::new(
        FactoryMock::spawn
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let captured = recovered.clone();
                let replacement = Unimock::new((
                    WorkerMock::handshake
                        .some_call(matching!(_))
                        .returns(Ok(())),
                    WorkerMock::request
                        .some_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, request, _| {
                            assert!(matches!(request.call, Call::Bundle(_)));
                            captured.lock().unwrap().push("bundle");
                            Ok(answer("seed"))
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
    assert_eq!(bundle(&pool).cache, Some(CacheOutcome::Damaged));
    assert_eq!(
        *events.lock().unwrap(),
        ["load", "restore-failed", "invalidate", "bundle"]
    );
}

#[test]
fn cancellation_during_restore_does_not_retire_or_write_the_record() {
    let store = Unimock::new(
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(hit("seed")),
    );
    let worker = Unimock::new((
        WorkerMock::request
            .some_call(matching!(_, _))
            .returns(Err(Error::Cancelled)),
        ControlMock::kill.some_call(matching!()).returns(Ok(())),
    ));
    let pool = pool(store, worker);
    assert!(matches!(
        pool.request(Call::Bundle(params())),
        Err(Error::Cancelled)
    ));
    assert_eq!(pool.lock().compiled.len(), 0);
    assert_eq!(pool.lock().slots.iter().flatten().count(), 1);
}

#[test]
fn a_restore_retirement_store_fault_reports_unavailable_for_an_incomplete_result() {
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(hit("seed")),
        BundleStoreMock::invalidate
            .some_call(matching!(_, _))
            .returns(WriteOutcome::StoreFault),
    ));
    let worker = Unimock::new((
        WorkerMock::request.each_call(matching!(_, _)).answers(
            &|_, request, _| match request.call {
                Call::RestoreGeneration(_) => Err(Error::Remote {
                    code: RemoteCode::Request(RequestCode::BundleFailed),
                    message: "rejected".into(),
                }),
                Call::Bundle(_) => {
                    let mut result = answer("partial");
                    if let MethodResult::Bundle(bundle) = &mut result {
                        bundle.compiled.reuse_evidence.complete = false;
                    }
                    Ok(result)
                }
                _ => panic!("unexpected request"),
            },
        ),
        WorkerMock::resident_bytes
            .some_call(matching!())
            .returns(Ok(0)),
    ));
    let pool = pool(store, worker);
    let result = bundle(&pool);
    assert_eq!(result.cache, Some(CacheOutcome::Unavailable));
    assert_eq!(result.generation, "partial");
}
