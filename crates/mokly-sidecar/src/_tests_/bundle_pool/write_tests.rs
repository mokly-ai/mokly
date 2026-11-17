//! Every complete served recipe applies the same bounded publication rule.

use std::sync::{Arc, Mutex, Weak};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, ReadMiss, ReadOutcome, WriteOutcome};
use crate::error::{Error, RemoteCode, RequestCode};
use crate::methods::Call;
use crate::pool::{Pool, SidecarPool};
use crate::pool_state::State;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

use super::{answer, bundle, live, pool, worker};

#[test]
fn a_changed_disk_seed_and_each_valid_fast_path_revert_reach_the_store() {
    let saved = Arc::new(Mutex::new(vec![]));
    let captured = saved.clone();
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(super::hit("old")),
        BundleStoreMock::save
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, recipe| {
                captured
                    .lock()
                    .unwrap()
                    .push(recipe.generation().to_owned());
                WriteOutcome::Written
            })),
    ));
    let pool = pool(store, worker(Arc::default(), "new"));
    live(&pool, "old", 1, false, false);
    assert_eq!(bundle(&pool).cache, Some(CacheOutcome::StampMismatch));
    live(&pool, "old", 1, true, false);
    pool.served_generation("old", 1);
    pool.served_generation("old", 1);
    pool.served_generation("old", 9);
    assert_eq!(*saved.lock().unwrap(), ["new", "old", "old"]);
}

#[test]
fn incomplete_bundles_and_direct_serves_never_write() {
    let saved = Arc::new(Mutex::new(vec![]));
    let captured = saved.clone();
    let store = Unimock::new((
        BundleStoreMock::load
            .each_call(matching!(_))
            .returns(ReadOutcome::Miss(ReadMiss::Absent)),
        BundleStoreMock::save
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, recipe| {
                captured
                    .lock()
                    .unwrap()
                    .push(recipe.generation().to_owned());
                WriteOutcome::Written
            })),
    ));
    let incomplete = Unimock::new((
        WorkerMock::request
            .some_call(matching!(_, _))
            .answers(&|_, _, _| {
                let mut result = answer("partial");
                if let MethodResult::Bundle(bundle) = &mut result {
                    bundle.compiled.reuse_evidence.complete = false;
                }
                Ok(result)
            }),
        WorkerMock::resident_bytes
            .some_call(matching!())
            .returns(Ok(0)),
    ));
    let pool = pool(store, incomplete);
    let result = bundle(&pool);
    pool.served_generation(&result.generation, result.epoch);
    assert_eq!(result.cache, Some(CacheOutcome::NoRecord));
    assert_eq!(pool.lock().compiled.len(), 1);
    assert_eq!(saved.lock().unwrap().len(), 0);
    live(&pool, "complete", 8, true, false);
    pool.served_generation("complete", 8);
    assert_eq!(*saved.lock().unwrap(), ["complete"]);
}

#[test]
fn failed_bundle_requests_never_publish_the_unserved_live_recipe() {
    let saved = Arc::new(Mutex::new(vec![]));
    let captured = saved.clone();
    let store = Unimock::new(
        BundleStoreMock::save
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, recipe| {
                captured
                    .lock()
                    .unwrap()
                    .push(recipe.generation().to_owned());
                WriteOutcome::Written
            })),
    );
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers(&|_, request, _| {
                if matches!(request.call, Call::Bundle(_)) {
                    Err(Error::Remote {
                        code: RemoteCode::Request(RequestCode::BundleFailed),
                        message: "invalid source".into(),
                    })
                } else {
                    Ok(MethodResult::Empty)
                }
            }),
        WorkerMock::resident_bytes
            .some_call(matching!())
            .returns(Ok(0)),
    ));
    let pool = pool(store, worker);
    live(&pool, "old", 1, true, false);
    let result = pool.request(Call::Bundle(super::params()));
    assert!(matches!(
        result,
        Err(Error::Remote {
            code: RemoteCode::Request(RequestCode::BundleFailed),
            ..
        })
    ));
    assert_eq!(saved.lock().unwrap().len(), 0);
    pool.served_generation("old", 1);
    assert_eq!(*saved.lock().unwrap(), ["old"]);
}

#[test]
fn served_notices_release_the_pool_mutex_before_optional_store_io() {
    let owner: Arc<Mutex<Weak<Pool>>> = Arc::default();
    let caller = owner.clone();
    let offered = Arc::new(Mutex::new(vec![]));
    let captured = offered.clone();
    let store = Unimock::new(
        BundleStoreMock::save
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, recipe| {
                let pool = caller.lock().unwrap().upgrade().unwrap();
                let state: &Mutex<State> = &pool.state;
                assert!(
                    state.try_lock().is_ok(),
                    "store IO must not hold the pool mutex"
                );
                captured
                    .lock()
                    .unwrap()
                    .push(recipe.generation().to_owned());
                WriteOutcome::Written
            })),
    );
    let pool = pool(store, Unimock::new(()));
    *owner.lock().unwrap() = Arc::downgrade(&pool);
    live(&pool, "served", 1, true, false);
    pool.served_generation("served", 1);
    assert_eq!(*offered.lock().unwrap(), ["served"]);
}
