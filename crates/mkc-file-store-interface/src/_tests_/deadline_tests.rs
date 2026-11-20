//! Storage operation deadline derivation and exhaustion.

#![allow(clippy::unwrap_used)]

use std::time::Duration as StdDuration;

use chrono::{Duration, TimeZone, Utc};

use super::{MAX_OPERATION_DURATION, OperationDeadline};

#[test]
fn attempt_budget_is_capped_and_must_be_positive() {
    let now = Utc.with_ymd_and_hms(2026, 9, 27, 12, 0, 0).unwrap();
    assert_eq!(
        OperationDeadline::for_attempt(now, now + Duration::minutes(15))
            .unwrap()
            .timeout(),
        MAX_OPERATION_DURATION
    );
    assert_eq!(
        OperationDeadline::for_attempt(now, now + Duration::seconds(17))
            .unwrap()
            .timeout(),
        StdDuration::from_secs(17)
    );
    assert!(OperationDeadline::for_attempt(now, now).is_none());
    assert!(OperationDeadline::for_attempt(now, now - Duration::seconds(1)).is_none());
}

#[test]
fn elapsed_time_reduces_one_shared_budget() {
    let deadline = OperationDeadline::new(StdDuration::from_secs(60));
    assert_eq!(
        deadline
            .remaining_after(StdDuration::from_secs(52))
            .unwrap(),
        StdDuration::from_secs(8)
    );
    assert!(
        deadline
            .remaining_after(StdDuration::from_secs(60))
            .is_err()
    );
}
