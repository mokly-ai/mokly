//! Compact replies reconstruct before pool metadata and preserve protocol recovery.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use serde_json::json;
use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, ReadOutcome, RecordToken, WriteOutcome};
use crate::client::{Client, SidecarClient, TransportMock};
use crate::durable_recipe::DurableRecipe;
use crate::error::{Error, ProtocolError};
use crate::methods::{BundleRequest, Call};
use crate::pool::SidecarPool;
use crate::resolution_plan::{PlannedImport, PlannedImportKind, ResolutionPlan};
use crate::results::Module;
use crate::reusable_recipe::ReusableRecipe;
use crate::wire::{Frame, MethodResult, Response};
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

use super::{Events, answer, compilation, params, pool, unchanged_hit};

fn worker(replies: Vec<serde_json::Value>, events: Events, killed: bool) -> Unimock {
    let replies = Mutex::new(VecDeque::from(replies));
    let sent = events.clone();
    let transport = Unimock::new((
        TransportMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                sent.lock().unwrap().push(match &request.call {
                    Call::RestoreGeneration(value) => format!("restore:{}", value.generation),
                    Call::Dispose(value) => format!("dispose:{}", value.generation),
                    Call::Bundle(_) => "bundle".into(),
                    _ => panic!("unexpected client request"),
                });
                Ok(())
            })),
        TransportMock::receive
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let value = replies.lock().unwrap().pop_front().ok_or(Error::Crashed)?;
                Ok(Frame::Response(Response::Success {
                    id: 1,
                    result: to_raw_value(&value).unwrap(),
                }))
            })),
    ));
    let client = Mutex::new(Client::new(
        Box::new(transport.clone()),
        Box::new(transport),
        "fixture".into(),
    ));
    let request = WorkerMock::request
        .each_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, request, _| {
            client.lock().unwrap().request(request)
        }));
    let resident = WorkerMock::resident_bytes
        .each_call(matching!())
        .answers(&|_| Ok(0));
    if killed {
        Unimock::new((
            request,
            resident,
            ControlMock::kill
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    events.lock().unwrap().push("kill".into());
                    Ok(())
                }))
                .once(),
        ))
    } else {
        Unimock::new((request, resident))
    }
}

fn call() -> Call {
    Call::Bundle(BundleRequest {
        params: params(),
        preparation: None,
        plan: None,
        capture: None,
    })
}

#[test]
fn a_short_reply_keeps_the_shared_disk_recipe_graph_and_pool_metadata() {
    let plan = Arc::new(ResolutionPlan {
        paths: vec!["/repo/entry.ts".into(), "/repo/shared.ts".into()],
        imports: vec![PlannedImport(
            0,
            "./shared".into(),
            PlannedImportKind::ImportStatement,
            1,
            true,
        )],
        candidates: None,
    });
    let mut compiled = compilation("seed", true);
    compiled.unmapped_dependency_directories = Some(vec!["packages/unmapped".into()]);
    let stored = DurableRecipe::new(
        ReusableRecipe::new(
            "seed".into(),
            params(),
            vec![Module {
                package_import: None,
                path: "entry.ts".into(),
                digest: Some("entry-digest".into()),
                imports: vec!["shared.ts".into()],
            }]
            .into(),
            Arc::new(compiled),
        )
        .unwrap(),
    )
    .unwrap()
    .with_plan(Some(plan.clone()));
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(ReadOutcome::Hit {
                recipe: Box::new(stored.clone()),
                token: RecordToken::new([7; 32]),
                maintenance: WriteOutcome::Unchanged,
            }),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ));
    let events = Arc::new(Mutex::new(vec![]));
    let pool = pool(
        store,
        worker(
            vec![
                json!(null),
                json!({"generation":"live","restoredGeneration":"disk:seed"}),
                json!(null),
            ],
            events.clone(),
            false,
        ),
    );
    let result = pool.request(call());
    assert!(
        matches!(&result, Ok(MethodResult::Bundle(_))),
        "pool must receive a reconstructed bundle: {result:?}"
    );
    let result = result.unwrap().into_bundle();
    assert_eq!(result.generation, "live");
    assert_eq!(
        serde_json::to_value(&result.compiled).unwrap(),
        serde_json::to_value(stored.compiled()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&result.modules).unwrap(),
        serde_json::to_value(stored.modules()).unwrap()
    );
    assert!(Arc::ptr_eq(&result.compiled, stored.compiled()));
    assert_eq!(result.modules.as_ptr(), stored.modules().as_ptr());
    assert!(Arc::ptr_eq(
        &pool.lock().compiled["live"],
        stored.compiled()
    ));
    assert_eq!(
        pool.lock().modules["live"].as_ptr(),
        stored.modules().as_ptr()
    );
    assert_eq!(
        result.unmapped_dependency_directories,
        Some(vec!["packages/unmapped".into()])
    );
    assert_eq!(result.plan, Some(plan));
    assert_eq!(result.epoch, 1);
    assert_eq!(result.cache, Some(CacheOutcome::Hit));
    assert_eq!(result.compile_count, 0);
    assert_eq!(
        *events.lock().unwrap(),
        ["restore:disk:seed", "bundle", "dispose:disk:seed"]
    );
}

#[test]
fn an_unknown_short_reference_replaces_the_worker_without_retrying_the_failed_call() {
    let events = Arc::new(Mutex::new(vec![]));
    let mut pool = pool(
        unchanged_hit(),
        worker(
            vec![
                json!(null),
                json!({"generation":"live","restoredGeneration":"disk:seed"}),
                json!(null),
                json!({"generation":"invalid","restoredGeneration":"unknown"}),
            ],
            events.clone(),
            true,
        ),
    );
    {
        let mut state = pool.lock();
        state.available = [0].into();
    }
    let spawned = events.clone();
    Arc::get_mut(&mut pool).unwrap().factory = Arc::new(Unimock::new(
        FactoryMock::spawn
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                spawned.lock().unwrap().push("spawn".into());
                let requested = spawned.clone();
                let replacement = Unimock::new((
                    WorkerMock::handshake
                        .some_call(matching!(_))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, request, _| match &request.call {
                            Call::RestoreGeneration(value) => {
                                requested
                                    .lock()
                                    .unwrap()
                                    .push(format!("restore:{}", value.generation));
                                Ok(MethodResult::Empty)
                            }
                            Call::Bundle(_) => {
                                requested.lock().unwrap().push("replacement-bundle".into());
                                Ok(answer("fresh", 1))
                            }
                            _ => panic!("unexpected replacement request"),
                        })),
                    WorkerMock::resident_bytes
                        .each_call(matching!())
                        .answers(&|_| Ok(0)),
                ));
                Ok(Spawned {
                    worker: Box::new(replacement.clone()),
                    control: Arc::new(replacement),
                })
            })),
    ));
    let first = pool.request(call());
    assert!(
        matches!(&first, Ok(MethodResult::Bundle(_))),
        "first compact reply must reconstruct: {first:?}"
    );
    assert_eq!(first.unwrap().into_bundle().generation, "live");
    let failed = pool.request(call());
    assert!(
        matches!(failed, Err(Error::Protocol(ProtocolError::Json { .. }))),
        "invalid reference must retain its protocol class: {failed:?}"
    );
    assert_eq!(
        *events.lock().unwrap(),
        [
            "restore:disk:seed",
            "bundle",
            "dispose:disk:seed",
            "bundle",
            "kill"
        ]
    );
    assert!(pool.lock().slots[0].is_none());
    let replacement = pool.request(call()).unwrap().into_bundle();
    assert_eq!(replacement.generation, "fresh");
    assert_eq!(replacement.compile_count, 1);
    assert_eq!(
        *events.lock().unwrap(),
        [
            "restore:disk:seed",
            "bundle",
            "dispose:disk:seed",
            "bundle",
            "kill",
            "spawn",
            "restore:live",
            "replacement-bundle"
        ]
    );
}
