//! One busy bundle request whose short reply names a seed that a concurrent step releases.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, Weak, mpsc};
use std::thread;

use serde_json::json;
use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_store::{BundleStoreMock, ReadOutcome, RecordToken, WriteOutcome};
use crate::client::{Client, SidecarClient, TransportMock};
use crate::compiled::{CompiledGeneration, RestoreGeneration, UncapturedEvidence};
use crate::durable_recipe::DurableRecipe;
use crate::error::{Error, RemoteCode, RequestCode, Result};
use crate::methods::{BundleCapture, BundleRequest, Call};
use crate::pool::{Pool, SidecarPool};
use crate::pool_recipes::Recipes;
use crate::results::Module;
use crate::reusable_recipe::ReusableRecipe;
use crate::wire::{Frame, RemoteError, Request, Response};
use crate::workers::{ControlMock, WorkerMock};

use super::{compilation, live, params, pool};

#[derive(Clone, Copy)]
pub(super) enum Finish {
    Success,
    Failure,
    Stop,
}

/// The seed that the short reply names.
#[derive(Clone, Copy)]
pub(super) enum Seed {
    /// A live generation that the attempt restores.
    Live,
    /// A live generation that the slot already holds.
    Loaded,
    /// A released recipe of equal settings.
    Released,
    /// A Serve edit fallback beside a captured live candidate.
    Fallback,
    /// A recipe that the attempt loads from the disk store.
    Disk,
}

pub(super) struct Observation {
    pub(super) during: (usize, usize),
    pub(super) returned: (usize, usize),
    pub(super) released: (usize, usize),
    pub(super) result: Result<String>,
}

type Storage = (Weak<CompiledGeneration>, Weak<Vec<Module>>);

fn response(value: serde_json::Value) -> Frame {
    Frame::Response(Response::Success {
        id: 1,
        result: to_raw_value(&value).unwrap(),
    })
}

fn graph() -> Arc<Vec<Module>> {
    Arc::new(vec![Module {
        path: "entry.ts".into(),
        imports: vec!["shared.ts".into()],
        digest: Some("entry-digest".into()),
    }])
}

fn weak(compiled: &Arc<CompiledGeneration>, modules: &Arc<Vec<Module>>) -> Storage {
    (Arc::downgrade(compiled), Arc::downgrade(modules))
}

/// Install a live generation with a real module graph and return its storage.
fn live_graph(pool: &Pool, id: &str, epoch: u64, complete: bool) -> Storage {
    live(pool, id, epoch, complete, false);
    let mut state = pool.lock();
    state.modules.insert(id.into(), graph());
    weak(&state.compiled[id], &state.modules[id])
}

/// Prepare a pool seed and return its storage; the attempt takes a disk seed from the store.
fn seed(pool: &Arc<Pool>, client: &Mutex<Client>, seed: Seed) -> Storage {
    pool.lock().recipes = Recipes::new(0);
    match seed {
        Seed::Live => live_graph(pool, "source", 1, true),
        Seed::Loaded => {
            let storage = live_graph(pool, "source", 1, true);
            let request = {
                let mut state = pool.lock();
                let slot = state.slots[0].as_mut().unwrap();
                slot.generations.insert("source".into(), 1);
                Request {
                    id: 1,
                    quiet: false,
                    call: Call::RestoreGeneration(Box::new(RestoreGeneration {
                        generation: "source".into(),
                        params: params(),
                        compiled: state.compiled["source"].clone(),
                        modules: state.modules["source"].clone(),
                    })),
                }
            };
            client.lock().unwrap().request(&request).unwrap();
            storage
        }
        Seed::Released => {
            let (compiled, modules) = (Arc::new(compilation("source", true)), graph());
            let storage = weak(&compiled, &modules);
            let mut state = pool.lock();
            state.recipes = Recipes::new(1 << 20);
            state
                .recipes
                .insert("source".into(), params(), modules, compiled);
            storage
        }
        Seed::Fallback => {
            live_graph(pool, "captured", 2, true);
            live_graph(pool, "edit", 1, false);
            let mut state = pool.lock();
            let compiled = Arc::make_mut(state.compiled.get_mut("edit").unwrap());
            let evidence = Arc::make_mut(&mut compiled.reuse_evidence);
            evidence.uncaptured = Some(UncapturedEvidence::ServeEdit);
            evidence.durable = false;
            evidence.inputs.clear();
            weak(&state.compiled["edit"], &state.modules["edit"])
        }
        Seed::Disk => unreachable!("the disk seed comes from the store"),
    }
}

/// A store whose load hands over its only copy of the recipe.
fn disk_store() -> (Unimock, Storage) {
    let (compiled, modules) = (Arc::new(compilation("source", true)), graph());
    let storage = weak(&compiled, &modules);
    let recipe = DurableRecipe::new(
        ReusableRecipe::new("source".into(), params(), modules, compiled).unwrap(),
    )
    .unwrap();
    let loaded = Mutex::new(Some(ReadOutcome::Hit {
        recipe: Box::new(recipe),
        token: RecordToken::new([7; 32]),
        maintenance: WriteOutcome::Unchanged,
    }));
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| loaded.lock().unwrap().take().unwrap())),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ));
    (store, storage)
}

pub(super) fn exercise(finish: Finish, kind: Seed) -> Observation {
    let (entered, started) = mpsc::sync_channel(0);
    let (resume, resumed) = mpsc::sync_channel(0);
    let resumed = Mutex::new(resumed);
    let replies = Arc::new(Mutex::new(VecDeque::new()));
    let queued = replies.clone();
    let transport = Unimock::new((
        TransportMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                let reply = match (&request.call, finish) {
                    (Call::Bundle(_), Finish::Failure) => Frame::Response(Response::Failure {
                        id: 1,
                        error: RemoteError {
                            code: RemoteCode::Request(RequestCode::BundleFailed),
                            message: "source failed".into(),
                            postcss: None,
                        },
                    }),
                    (Call::Bundle(_), _) => response(json!({
                        "generation": "result",
                        "restoredGeneration": restored(kind),
                    })),
                    _ => response(json!(null)),
                };
                queued.lock().unwrap().push_back(reply);
                if matches!(request.call, Call::Bundle(_)) {
                    entered.send(()).unwrap();
                    resumed.lock().unwrap().recv().unwrap();
                }
                Ok(())
            })),
        TransportMock::receive
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                replies.lock().unwrap().pop_front().ok_or(Error::Crashed)
            })),
    ));
    let client = Arc::new(Mutex::new(Client::new(
        Box::new(transport.clone()),
        Box::new(transport),
        "fixture".into(),
    )));
    let requested = client.clone();
    let request = WorkerMock::request
        .each_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, request, _| {
            requested.lock().unwrap().request(request)
        }));
    let worker = match finish {
        Finish::Stop => Unimock::new((
            request,
            ControlMock::kill.some_call(matching!()).returns(Ok(())),
        )),
        _ => Unimock::new((
            request,
            WorkerMock::resident_bytes
                .each_call(matching!())
                .answers(&|_| Ok(0)),
        )),
    };
    let (store, disk) = match (finish, kind) {
        (_, Seed::Disk) => {
            let (store, storage) = disk_store();
            (store, Some(storage))
        }
        (Finish::Success, Seed::Fallback) => (Unimock::new(()), None),
        (Finish::Success, _) => (
            Unimock::new(
                BundleStoreMock::save
                    .some_call(matching!(_))
                    .returns(WriteOutcome::Unchanged),
            ),
            None,
        ),
        _ => (Unimock::new(()), None),
    };
    let pool = pool(store, worker.clone());
    pool.lock().available = [0].into();
    let (compiled, modules) = match disk {
        Some(storage) => {
            pool.lock().recipes = Recipes::new(0);
            storage
        }
        None => seed(&pool, &client, kind),
    };
    let requested = pool.clone();
    let capture = matches!(kind, Seed::Fallback).then_some(BundleCapture::ServeEdit);
    let request = thread::spawn(move || {
        requested.request(Call::Bundle(BundleRequest {
            params: params(),
            capture,
            preparation: None,
            plan: None,
        }))
    });
    started.recv().unwrap();
    match kind {
        Seed::Live | Seed::Loaded => pool.release_generation("source", 1),
        Seed::Released => pool.lock().recipes = Recipes::new(0),
        Seed::Fallback => pool.release_generation("edit", 1),
        Seed::Disk => {}
    }
    if matches!(finish, Finish::Stop) {
        pool.abort().unwrap();
    }
    let during = (compiled.strong_count(), modules.strong_count());
    resume.send(()).unwrap();
    let result = request.join().unwrap();
    let returned = (compiled.strong_count(), modules.strong_count());
    let result = match result {
        Ok(result) => {
            let result = result.into_bundle();
            let generation = result.generation.clone();
            pool.release_generation(&result.generation, result.epoch);
            pool.synchronize_releases();
            drop(result);
            Ok(generation)
        }
        Err(error) => {
            pool.synchronize_releases();
            Err(error)
        }
    };
    Observation {
        during,
        returned,
        released: (compiled.strong_count(), modules.strong_count()),
        result,
    }
}

fn restored(kind: Seed) -> &'static str {
    match kind {
        Seed::Live | Seed::Loaded => "source",
        Seed::Released => "released:source",
        Seed::Fallback => "edit",
        Seed::Disk => "disk:source",
    }
}
