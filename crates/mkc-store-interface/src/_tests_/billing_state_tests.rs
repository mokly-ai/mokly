//! Persisted billing state round-trip cases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use crate::billing_state::{BillingFailure, ParseError, SubscriptionStatus};

#[test]
fn subscription_statuses_round_trip_through_stable_values() {
    for status in [
        SubscriptionStatus::Trialing,
        SubscriptionStatus::Active,
        SubscriptionStatus::PastDue,
        SubscriptionStatus::Canceled,
        SubscriptionStatus::Unpaid,
        SubscriptionStatus::Incomplete,
        SubscriptionStatus::IncompleteExpired,
        SubscriptionStatus::Paused,
    ] {
        assert_eq!(
            status.as_str().parse::<SubscriptionStatus>().unwrap(),
            status
        );
    }
    assert!(matches!(
        "unknown".parse::<SubscriptionStatus>(),
        Err(ParseError::SubscriptionStatus)
    ));
}

#[test]
fn billing_failures_round_trip_through_stable_values() {
    for failure in [
        BillingFailure::Malformed,
        BillingFailure::Conflict,
        BillingFailure::Unavailable,
        BillingFailure::RateLimited,
        BillingFailure::Internal,
    ] {
        assert_eq!(failure.as_str().parse::<BillingFailure>().unwrap(), failure);
    }
    assert!(matches!(
        "forbidden".parse::<BillingFailure>(),
        Err(ParseError::BillingFailure)
    ));
}
