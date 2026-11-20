//! Cached readiness, expiry and failure coverage at injected trait boundaries.

#![allow(clippy::unwrap_used)]

use std::io;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use mkc_db::migration::{CurrentMock, Error};
use rpc_error::RpcError;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;

use super::{DatabaseHealth, HealthCheck, HealthClockMock};

#[test]
fn current_result_is_cached_until_expiry_then_pending_is_distinct() {
    let start = Instant::now();
    let checker: &dyn HealthCheck = &DatabaseHealth {
        migrations: Arc::new(Unimock::new((
            CurrentMock.next_call(matching!()).returns(Ok(true)),
            CurrentMock.next_call(matching!()).returns(Ok(false)),
        ))),
        clock: Arc::new(Unimock::new((
            HealthClockMock.next_call(matching!()).returns(start),
            HealthClockMock
                .next_call(matching!())
                .returns(start + Duration::from_secs(4)),
            HealthClockMock
                .next_call(matching!())
                .returns(start + Duration::from_secs(5)),
        ))),
        cache: Mutex::new(None),
    };
    for _ in 0..2 {
        let result = serde_json::to_value(checker.check().unwrap()).unwrap();
        assert_eq!(result["status"], "ok");
        assert_eq!(result["migrations"], "current");
        assert_eq!(result["version"], env!("CARGO_PKG_VERSION"));
    }
    let error = RpcError::from(checker.check().unwrap_err());
    assert_eq!(error.status_code_u16(), 503);
    assert_eq!(error.code().as_str(), "unavailable");
    assert_eq!(error.reason(), "migrations-pending");
}

#[test]
fn failures_are_cached_redacted_and_retried_after_expiry() {
    let start = Instant::now();
    let checker: &dyn HealthCheck = &DatabaseHealth {
        migrations: Arc::new(Unimock::new((
            CurrentMock
                .next_call(matching!())
                .returns(Err(Error::internal(io::Error::other(
                    "postgres://secret:password@fixture",
                )))),
            CurrentMock.next_call(matching!()).returns(Ok(true)),
        ))),
        clock: Arc::new(Unimock::new((
            HealthClockMock.next_call(matching!()).returns(start),
            HealthClockMock
                .next_call(matching!())
                .returns(start + Duration::from_secs(1)),
            HealthClockMock
                .next_call(matching!())
                .returns(start + Duration::from_secs(5)),
        ))),
        cache: Mutex::new(None),
    };
    for _ in 0..2 {
        let error = RpcError::from(checker.check().unwrap_err());
        assert_eq!(error.status_code_u16(), 500);
        assert!(
            !serde_json::to_string(&error.output())
                .unwrap()
                .contains("password")
        );
    }
    assert!(checker.check().is_ok());
}

#[test]
fn concurrent_pending_checks_share_one_database_refresh() {
    let checker: Arc<dyn HealthCheck> = Arc::new(DatabaseHealth {
        migrations: Arc::new(Unimock::new(
            CurrentMock.next_call(matching!()).returns(Ok(false)),
        )),
        clock: Arc::new(Unimock::new(
            HealthClockMock
                .each_call(matching!())
                .returns(Instant::now()),
        )),
        cache: Mutex::new(None),
    });
    let threads: Vec<_> = (0..16)
        .map(|_| {
            let checker = checker.clone();
            thread::spawn(move || {
                assert!(matches!(checker.check(), Err(ApiError::MigrationsPending)))
            })
        })
        .collect();
    for thread in threads {
        thread.join().unwrap();
    }
}
