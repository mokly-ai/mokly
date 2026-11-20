//! Retry behavior with mocked attempts, jitter and sleeps.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::time::Duration;

use diesel::result::{DatabaseErrorKind, Error as DieselError};
use mkc_store_interface::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::retry::{AttemptMock, Backoff, Retry};
use crate::runtime::RuntimeMock;

fn serialization() -> Error {
    Error::internal(DieselError::DatabaseError(
        DatabaseErrorKind::SerializationFailure,
        Box::new("recorded serialization conflict".to_owned()),
    ))
}

#[test]
fn serialization_retries_with_exponential_backoff_and_jitter() {
    let mut attempt = Unimock::new((
        AttemptMock::run
            .next_call(matching!())
            .returns(Err(serialization())),
        AttemptMock::run
            .next_call(matching!())
            .returns(Err(serialization())),
        AttemptMock::run.next_call(matching!()).returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::jitter
            .next_call(matching!((d,) if *d == Duration::from_millis(5)))
            .returns(Ok(Duration::from_millis(2))),
        RuntimeMock::sleep
            .next_call(matching!((d,) if *d == Duration::from_millis(7)))
            .returns(()),
        RuntimeMock::jitter
            .next_call(matching!((d,) if *d == Duration::from_millis(10)))
            .returns(Ok(Duration::from_millis(3))),
        RuntimeMock::sleep
            .next_call(matching!((d,) if *d == Duration::from_millis(13)))
            .returns(()),
    ));
    let retry: &dyn Retry = &Backoff { runtime: &runtime };
    retry.execute(&mut attempt).unwrap();
}

#[test]
fn nonretryable_error_never_sleeps_or_retries() {
    let mut attempt = Unimock::new(
        AttemptMock::run
            .next_call(matching!())
            .returns(Err(Error::internal(DieselError::RollbackTransaction))),
    );
    let runtime = Unimock::new(());
    let retry: &dyn Retry = &Backoff { runtime: &runtime };
    assert!(matches!(
        retry.execute(&mut attempt),
        Err(Error::Internal(_))
    ));
}

#[test]
fn persistent_conflicts_exhaust_eight_attempts_and_seven_bounded_sleeps() {
    let mut attempt = Unimock::new(
        AttemptMock::run
            .each_call(matching!())
            .answers(&|_| Err(serialization()))
            .n_times(8),
    );
    let runtime = Unimock::new((
        RuntimeMock::jitter
            .each_call(matching!((d,) if *d <= Duration::from_millis(250)))
            .answers(&|_, _| Ok(Duration::ZERO))
            .n_times(7),
        RuntimeMock::sleep
            .each_call(matching!((d,) if *d <= Duration::from_millis(250)))
            .returns(())
            .n_times(7),
    ));
    let retry: &dyn Retry = &Backoff { runtime: &runtime };
    assert!(matches!(
        retry.execute(&mut attempt),
        Err(Error::Internal(_))
    ));
}
