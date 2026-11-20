//! A poisoned call log keeps the initial panic and permits later pool cleanup.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::{Arc, Mutex};

use mokly_sidecar::methods::{Call, Empty};
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::wire::MethodResult;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::recorded_calls::lock_calls;

use super::support::CapturedPool;

#[test]
fn poisoned_recorded_calls_preserve_the_original_panic_and_allow_pool_cleanup() {
    let pool = CapturedPool {
        calls: Mutex::default(),
        inner: Arc::new(Unimock::new((
            PoolMock::release_generation
                .some_call(matching!("before", 1))
                .returns(()),
            PoolMock::release_generation
                .some_call(matching!("after", 2))
                .returns(()),
            PoolMock::release_context
                .some_call(matching!("context"))
                .returns(()),
            PoolMock::request
                .some_call(matching!(Call::Shutdown(_)))
                .answers(&|_, _| Ok(MethodResult::Empty)),
        ))),
    };
    pool.release_generation("before", 1);
    let original = catch_unwind(AssertUnwindSafe(|| {
        let _calls = lock_calls(&pool.calls);
        panic!("original recorded-call failure");
    }))
    .unwrap_err();
    assert!(pool.calls.is_poisoned());

    let continued = catch_unwind(AssertUnwindSafe(|| {
        pool.release_generation("after", 2);
        pool.release_context("context");
        let response = pool.request(Call::Shutdown(Empty::default()));
        (response, lock_calls(&pool.calls).clone())
    }));
    assert!(
        continued.is_ok(),
        "recorded calls must remain usable after the original panic"
    );
    let (response, calls) = continued.unwrap();
    assert!(matches!(response.unwrap(), MethodResult::Empty));
    assert_eq!(
        serde_json::to_value(calls).unwrap(),
        json!([
            {"method": "dispose", "params": {"generation": "before"}},
            {"method": "dispose", "params": {"generation": "after"}},
            {"method": "disposeContext", "params": {"context": "context"}},
            {"method": "shutdown", "params": {}}
        ])
    );
    assert_eq!(
        original.downcast_ref::<&str>(),
        Some(&"original recorded-call failure")
    );
}
