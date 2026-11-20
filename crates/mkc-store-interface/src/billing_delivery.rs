//! Durable Stripe webhook acceptance, leases and retry state queries.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::billing_state::BillingFailure;
use crate::error::Result;
use crate::github_state::DeliveryStatus;

/// Original signed Stripe delivery with durable processing state.
#[derive(Clone, Debug)]
pub struct BillingDelivery {
    /// Stripe event identifier used for idempotency.
    pub id: String,
    /// Validated Stripe event type, including unknown events.
    pub event: String,
    /// Original verified bytes, never reconstructed from JSON.
    pub body: Vec<u8>,
    /// Initial acceptance time.
    pub received_at: DateTime<Utc>,
    /// Earliest retry time.
    pub due_at: DateTime<Utc>,
    /// Attempts in this processing cycle.
    pub attempts: i32,
    /// Current queue state.
    pub status: DeliveryStatus,
    /// Unique fencing token for the current claim.
    pub lease: Option<Uuid>,
    /// Recovery deadline for an interrupted claim.
    pub lease_until: Option<DateTime<Utc>>,
    /// Safe typed failure category without provider payloads.
    pub last_failure: Option<BillingFailure>,
}

/// Queue statements only; the billing worker owns handler and retry policy.
#[unimock::unimock(api = BillingDeliveriesMock)]
pub trait BillingDeliveries {
    /// Read a delivery for idempotency or fenced completion.
    fn billing_delivery(&mut self, id: &str) -> Result<Option<BillingDelivery>>;
    /// Persist accepted bytes or a policy-approved state transition.
    fn save_billing_delivery(&mut self, value: &BillingDelivery) -> Result<()>;
    /// Atomically claim one due delivery with SKIP LOCKED.
    fn claim_billing_delivery(
        &mut self,
        now: DateTime<Utc>,
        lease: Uuid,
        until: DateTime<Utc>,
    ) -> Result<Option<BillingDelivery>>;
    /// Mark exhausted crashed deliveries failed before claiming work.
    fn expire_billing_deliveries(&mut self, now: DateTime<Utc>) -> Result<()>;
    /// Count retained deliveries that require operator recovery.
    fn billing_dead_letter_count(&mut self) -> Result<i64>;
}
