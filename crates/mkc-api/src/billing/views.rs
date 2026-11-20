//! Billing response models aligned with the OpenAPI schema.

use chrono::{DateTime, Utc};
use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::billing_state::SubscriptionStatus;
use serde::Serialize;
use utoipa::ToSchema;

/// The workspace's plan, seat usage and subscription facts, as
/// docs/protocol/cloud/billing.md defines them. Amounts are the verified unit amounts of the
/// catalogue-resolved prices in USD cents; the client computes the monthly total from
/// counts and amounts and never types a price.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Billing {
    pub(super) plan: Plan,
    /// Exactly one entry per seat kind, editor then collaborator.
    #[schema(value_type = BTreeSet<SeatUsage>, min_items = 2, max_items = 2)]
    pub(super) seats: Vec<SeatUsage>,
    #[schema(required)]
    pub(super) subscription: Option<Subscription>,
    /// Whether the caller may start Checkout or open the Portal.
    pub(super) manageable: bool,
    /// As defined in the billing protocol: both prices verified and no live subscription.
    pub(super) checkout_available: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SeatUsage {
    pub(super) kind: SeatKind,
    #[schema(minimum = 0)]
    pub(super) in_use: i64,
    /// Monthly price per seat in USD cents, null while the price is unverified.
    #[schema(required, minimum = 0)]
    pub(super) unit_amount_cents: Option<u32>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Subscription {
    #[schema(inline)]
    pub(super) status: Status,
    #[schema(required, format = DateTime)]
    pub(super) trial_end: Option<DateTime<Utc>>,
    /// The subscription items' shared billing period end; the pinned Stripe API version
    /// carries the period on items.
    #[schema(required, format = DateTime)]
    pub(super) current_period_end: Option<DateTime<Utc>>,
    pub(super) cancel_at_period_end: bool,
    /// When the latest failed invoice was observed; null after a paid invoice clears the
    /// failure.
    #[schema(required, format = DateTime)]
    pub(super) payment_failed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Copy, Debug, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub(super) enum Status {
    Trialing,
    Active,
    PastDue,
    Canceled,
    Unpaid,
    Incomplete,
    IncompleteExpired,
    Paused,
}

impl From<SubscriptionStatus> for Status {
    fn from(value: SubscriptionStatus) -> Self {
        match value {
            SubscriptionStatus::Trialing => Self::Trialing,
            SubscriptionStatus::Active => Self::Active,
            SubscriptionStatus::PastDue => Self::PastDue,
            SubscriptionStatus::Canceled => Self::Canceled,
            SubscriptionStatus::Unpaid => Self::Unpaid,
            SubscriptionStatus::Incomplete => Self::Incomplete,
            SubscriptionStatus::IncompleteExpired => Self::IncompleteExpired,
            SubscriptionStatus::Paused => Self::Paused,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[schema(as = CheckoutSession)]
pub(crate) struct HostedSession {
    /// Stripe-hosted Checkout page; the browser navigates there.
    #[schema(format = "uri")]
    pub(super) url: String,
}
