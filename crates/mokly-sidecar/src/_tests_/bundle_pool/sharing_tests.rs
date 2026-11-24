//! Equal recipes can retain a runtime key different from the worker's live key.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, ReadMiss, ReadOutcome, WriteOutcome};
use crate::methods::{BundleRequest, Call};
use crate::pool::{Pool, SidecarPool};
use crate::results;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

use super::{answer, params, pool};

fn worker(runtime: &'static str, entered: Sender<()>, released: Receiver<()>) -> Unimock {
    let calls = AtomicU64::new(0);
    let released = Mutex::new(released);
    Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let Call::Bundle(bundle) = &request.call else {
                    return Ok(MethodResult::Empty);
                };
                let compiled = calls.fetch_add(1, Ordering::SeqCst) == 0;
                if compiled {
                    entered.send(()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                }
                let MethodResult::Bundle(mut result) = answer("shared", u64::from(compiled)) else {
                    panic!("expected bundle")
                };
                result.generation = bundle.params.evaluation.clone().unwrap();
                Arc::make_mut(&mut result.compiled).runtime_key = runtime.into();
                Ok(MethodResult::Bundle(result))
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    ))
}

fn request(pool: &Pool, evaluation: &str) -> results::Bundle {
    let mut settings = params();
    settings.evaluation = Some(evaluation.into());
    pool.request(Call::Bundle(BundleRequest {
        preparation: None,
        plan: None,
        params: settings,
        capture: None,
    }))
    .unwrap()
    .into_bundle()
}

fn sharing_preserves_memory_provenance(second_evaluation: &'static str) {
    let store = Unimock::new((
        BundleStoreMock::load
            .each_call(matching!(_))
            .returns(ReadOutcome::Miss(ReadMiss::Absent)),
        BundleStoreMock::save
            .each_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ));
    let pool = pool(store, Unimock::new(()));
    let (first_entered, first_started) = mpsc::channel();
    let (second_entered, second_started) = mpsc::channel();
    let (first_release, first_released) = mpsc::channel();
    let (second_release, second_released) = mpsc::channel();
    {
        let mut state = pool.lock();
        state.slots[0].as_mut().unwrap().worker =
            Box::new(worker("runtime:first", first_entered, first_released));
        state.slots[1].as_mut().unwrap().worker =
            Box::new(worker("runtime:second", second_entered, second_released));
    }
    let first_pool = pool.clone();
    let first = thread::spawn(move || request(&first_pool, "first"));
    first_started.recv().unwrap();
    let second_pool = pool.clone();
    let second = thread::spawn(move || request(&second_pool, second_evaluation));
    second_started.recv().unwrap();
    first_release.send(()).unwrap();
    let first = first.join().unwrap();
    second_release.send(()).unwrap();
    let second = second.join().unwrap();
    assert_eq!(first.cache, Some(CacheOutcome::NoRecord));
    assert_eq!(second.cache, Some(CacheOutcome::NoRecord));
    assert_eq!(second.compiled.runtime_key, "runtime:second");
    assert!(Arc::ptr_eq(
        &pool.lock().compiled[second_evaluation],
        &first.compiled
    ));
    let reused = request(&pool, second_evaluation);
    assert_eq!(reused.compiled.runtime_key, "runtime:second");
    assert_eq!(reused.cache, Some(CacheOutcome::Memory));
    assert_eq!(
        pool.lock().slots[1].as_ref().unwrap().last_compilation,
        Some(2),
        "reuse must not replace the worker's last compilation epoch"
    );
}

#[test]
fn equal_evaluation_recipes_with_distinct_worker_keys_report_memory() {
    sharing_preserves_memory_provenance("first");
}

#[test]
fn different_evaluation_recipes_with_distinct_worker_keys_report_memory() {
    sharing_preserves_memory_provenance("second");
}
