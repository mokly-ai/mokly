//! Bundle pins survive final release without a client-owned recipe cache.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use serde_json::json;
use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_store::{BundleStoreMock, WriteOutcome};
use crate::client::{Client, SidecarClient, TransportMock};
use crate::compiled::RestoreGeneration;
use crate::error::{Error, RemoteCode, RequestCode, Result};
use crate::methods::{BundleRequest, Call};
use crate::pool::SidecarPool;
use crate::pool_recipes::Recipes;
use crate::results::Module;
use crate::wire::{Frame, RemoteError, Request, Response};
use crate::workers::{ControlMock, WorkerMock};

use super::{live, params, pool};

#[derive(Clone, Copy)]
enum Finish {
    Success,
    Failure,
    Stop,
}

struct Observation {
    during: (usize, usize),
    returned: (usize, usize),
    released: (usize, usize),
    result: Result<String>,
}

fn response(value: serde_json::Value) -> Frame {
    Frame::Response(Response::Success {
        id: 1,
        result: to_raw_value(&value).unwrap(),
    })
}

fn exercise(finish: Finish, loaded: bool) -> Observation {
    let (entered, started) = mpsc::sync_channel(0);
    let (resume, resumed) = mpsc::sync_channel(0);
    let resumed = Mutex::new(resumed);
    let reply = match finish {
        Finish::Failure => Frame::Response(Response::Failure {
            id: 1,
            error: RemoteError {
                code: RemoteCode::Request(RequestCode::BundleFailed),
                message: "source failed".into(),
                postcss: None,
            },
        }),
        _ => response(json!({"generation":"result", "restoredGeneration":"source"})),
    };
    let replies = Mutex::new(VecDeque::from([
        response(json!(null)),
        reply,
        response(json!(null)),
        response(json!(null)),
    ]));
    let transport = Unimock::new((
        TransportMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
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
    let store = match finish {
        Finish::Success => Unimock::new(
            BundleStoreMock::save
                .some_call(matching!(_))
                .returns(WriteOutcome::Unchanged),
        ),
        _ => Unimock::new(()),
    };
    let pool = pool(store, worker.clone());
    live(&pool, "source", 1, true, false);
    let (compiled, modules) = {
        let mut state = pool.lock();
        state.available = [0].into();
        state.recipes = Recipes::new(0);
        state.modules.insert(
            "source".into(),
            Arc::new(vec![Module {
                path: "entry.ts".into(),
                imports: vec!["shared.ts".into()],
                digest: Some("entry-digest".into()),
            }]),
        );
        (
            Arc::downgrade(&state.compiled["source"]),
            Arc::downgrade(&state.modules["source"]),
        )
    };
    if loaded {
        let request = {
            let mut state = pool.lock();
            state.slots[0]
                .as_mut()
                .unwrap()
                .generations
                .insert("source".into(), 1);
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
    }
    let requested = pool.clone();
    let request = thread::spawn(move || {
        requested.request(Call::Bundle(BundleRequest {
            params: params(),
            capture: None,
            preparation: None,
            plan: None,
        }))
    });
    started.recv().unwrap();
    pool.release_generation("source", 1);
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
        Err(error) => Err(error),
    };
    Observation {
        during,
        returned,
        released: (compiled.strong_count(), modules.strong_count()),
        result,
    }
}

#[test]
fn a_busy_bundle_pins_a_live_restore_across_final_release_and_recipe_eviction() {
    let result = exercise(Finish::Success, false);
    assert_eq!(
        result.during,
        (1, 1),
        "only the active pool attempt pins this recipe"
    );
    assert_eq!(
        result.returned,
        (2, 2),
        "only State and the result own the recipe after return"
    );
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Ok(generation) if generation == "result"));
}

#[test]
fn an_already_loaded_restore_stays_pinned_during_a_concurrent_final_release() {
    let result = exercise(Finish::Success, true);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (2, 2));
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Ok(generation) if generation == "result"));
}

#[test]
fn a_failed_bundle_drops_request_pins_before_return() {
    let result = exercise(Finish::Failure, false);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (0, 0));
    assert_eq!(result.released, (0, 0));
    assert!(
        matches!(result.result, Err(Error::Remote { code: RemoteCode::Request(RequestCode::BundleFailed), message }) if message == "source failed")
    );
}

#[test]
fn stopping_a_busy_bundle_drops_request_pins_before_return() {
    let result = exercise(Finish::Stop, false);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (0, 0));
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Err(Error::Cancelled)));
}
