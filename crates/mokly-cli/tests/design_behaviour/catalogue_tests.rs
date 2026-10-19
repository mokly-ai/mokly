//! Preparation and cleanup failures preserve the useful test failure.

use std::any::Any;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::{Arc, Mutex, Weak};

use mokly_sidecar::error::Error;
use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use super::{StopPool, preparation_lock};

#[test]
fn preparation_poison_names_the_prior_failure() {
    let shared = Mutex::new(Weak::new());
    let original = catch_unwind(|| {
        let _guard = shared.lock().unwrap();
        panic!("fixture preparation failed");
    });
    assert!(original.is_err());
    let failure = catch_unwind(|| {
        let _guard = preparation_lock(&shared);
    })
    .unwrap_err();
    assert!(
        message(failure.as_ref()).contains("design catalogue preparation failed in another test"),
        "{}",
        message(failure.as_ref())
    );
}

#[test]
fn shutdown_failure_fails_without_a_prior_panic() {
    let failure = catch_unwind(AssertUnwindSafe(|| {
        let _stop = failing_pool();
    }))
    .unwrap_err();
    assert!(message(failure.as_ref()).contains("Cancelled"));
}

#[test]
fn shutdown_failure_preserves_the_original_panic() {
    let failure = catch_unwind(AssertUnwindSafe(|| {
        let _stop = failing_pool();
        panic!("original design assertion");
    }))
    .unwrap_err();
    assert_eq!(message(failure.as_ref()), "original design assertion");
}

fn failing_pool() -> StopPool {
    StopPool(Arc::new(Unimock::new(
        PoolMock::shutdown
            .next_call(matching!())
            .returns(Err(Error::Cancelled)),
    )))
}

fn message(payload: &(dyn Any + Send)) -> &str {
    payload
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| payload.downcast_ref::<&str>().copied())
        .unwrap()
}
