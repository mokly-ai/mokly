//! Fake monotonic time proves storage retry and deadline behaviour without waits.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use mkc_file_store_interface::error::Error;
use mkc_file_store_interface::seed::{SeedStore, SeedStoreMock};
use mkc_file_store_interface::seed_name::SeedName;
use unimock::{MockFn, Unimock, matching};

use crate::preview_seed::retry::RetryingSeedStore;
use crate::preview_seed::timing::{ClockMock, SleeperMock};

#[test]
fn retries_seed_reads_and_writes_but_returns_absence_at_once() {
    let inner = Unimock::new((
        SeedStoreMock::get.stub(|each| {
            each.call(matching!((name, limit) if name.as_str() == "seed/run/request.json" && *limit == 64))
                .answers(&|_, _, _| Err(Error::internal_message("permission not ready")))
                .once().then().answers(&|_, _, _| Ok(Some(b"request".to_vec()))).once();
            each.call(matching!((name, _) if name.as_str() == "seed/run/seed-proof.json"))
                .answers(&|_, _, _| Ok(None)).once();
        }),
        SeedStoreMock::put.stub(|each| {
            each.call(matching!((name, bytes) if name.as_str() == "seed/run/seed-status.json" && bytes.as_ref() == b"status"))
                .answers(&|_, _, _| Err(Error::internal_message("permission not ready")))
                .once().then().answers(&|_, _, _| Ok(())).once();
        }),
    ));
    let clock = Unimock::new(
        ClockMock::now
            .each_call(matching!())
            .returns(Duration::ZERO),
    );
    let sleeper = Unimock::new(
        SleeperMock::sleep
            .some_call(matching!((duration,) if *duration == Duration::from_secs(2)))
            .returns(())
            .n_times(2),
    );
    let store = RetryingSeedStore {
        inner: Arc::new(inner),
        clock: Arc::new(clock),
        sleeper: Arc::new(sleeper),
    };
    let read = store.get(&SeedName::new("run", "request.json").unwrap(), 64);
    assert_eq!(read.as_ref().ok(), Some(&Some(b"request".to_vec())));
    assert!(
        store
            .put(
                &SeedName::new("run", "seed-status.json").unwrap(),
                Bytes::from_static(b"status")
            )
            .is_ok()
    );
    assert_eq!(
        store
            .get(&SeedName::new("run", "seed-proof.json").unwrap(), 64)
            .unwrap(),
        None
    );
}

#[test]
fn stops_seed_retries_at_two_minutes_and_caps_the_last_sleep() {
    let inner = Unimock::new(
        SeedStoreMock::get
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Err(Error::internal_message("permission not ready")))
            .n_times(2),
    );
    let clock = Unimock::new(ClockMock::now.stub(|each| {
        each.call(matching!())
            .returns(Duration::ZERO)
            .once()
            .then()
            .returns(Duration::from_secs(119))
            .once()
            .then()
            .returns(Duration::from_secs(120))
            .once();
    }));
    let sleeper = Unimock::new(
        SleeperMock::sleep
            .some_call(matching!((duration,) if *duration == Duration::from_secs(1)))
            .returns(()),
    );
    let store = RetryingSeedStore {
        inner: Arc::new(inner),
        clock: Arc::new(clock),
        sleeper: Arc::new(sleeper),
    };
    let result = store.get(&SeedName::new("run", "request.json").unwrap(), 64);
    assert!(matches!(result, Err(Error::Internal(_))));
}
