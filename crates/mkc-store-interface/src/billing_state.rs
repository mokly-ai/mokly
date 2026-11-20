//! Finite persisted Stripe subscription and delivery failure states.

use std::result;
use std::str::FromStr;

use thiserror::Error;

/// Corrupt persisted billing enum values, converted to store Internal at reads.
#[derive(Debug, Error)]
pub enum ParseError {
    /// Invalid Stripe subscription status.
    #[error("[mkc-store-interface/billing_state] invalid subscription status")]
    SubscriptionStatus,
    /// Invalid billing delivery failure category.
    #[error("[mkc-store-interface/billing_state] invalid billing failure category")]
    BillingFailure,
}

macro_rules! state {
    ($name:ident, $doc:literal, $(($variant:ident, $value:literal, $variant_doc:literal)),+ $(,)?) => {
        #[doc = $doc]
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        pub enum $name {
            $(#[doc = $variant_doc] $variant),+
        }

        impl $name {
            /// Stable SQL representation.
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }

        impl FromStr for $name {
            type Err = ParseError;

            fn from_str(value: &str) -> result::Result<Self, Self::Err> {
                match value {
                    $($value => Ok(Self::$variant)),+,
                    _ => Err(ParseError::$name),
                }
            }
        }
    };
}

state!(
    SubscriptionStatus,
    "Stripe subscription lifecycle state used to derive an organization's plan.",
    (Trialing, "trialing", "Trial is active."),
    (Active, "active", "Subscription is current."),
    (PastDue, "past_due", "Payment requires recovery."),
    (Canceled, "canceled", "Subscription has ended."),
    (Unpaid, "unpaid", "Stripe stopped collection attempts."),
    (Incomplete, "incomplete", "Initial payment is incomplete."),
    (
        IncompleteExpired,
        "incomplete_expired",
        "Incomplete initial payment expired."
    ),
    (Paused, "paused", "Trial ended without a payment method."),
);

impl SubscriptionStatus {
    /// Whether the subscription continues to grant Team access.
    pub fn is_live(self) -> bool {
        matches!(self, Self::Trialing | Self::Active | Self::PastDue)
    }
}

state!(
    BillingFailure,
    "Safe billing delivery failure class without provider payloads or secrets.",
    (Malformed, "malformed", "Known event failed typed decoding."),
    (
        Conflict,
        "conflict",
        "A different live subscription is already bound."
    ),
    (Unavailable, "unavailable", "Transient provider outage."),
    (
        RateLimited,
        "rate-limited",
        "Provider retry deadline must be honored."
    ),
    (
        Internal,
        "internal",
        "Unhandled database or runtime failure."
    ),
);

#[cfg(test)]
#[path = "_tests_/billing_state_tests.rs"]
mod billing_state_tests;
