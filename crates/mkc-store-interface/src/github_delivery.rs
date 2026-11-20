//! Durable webhook acceptance, leases and retry state queries.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::error::Result;
use crate::github_state::{DeliveryStatus, Failure};

/// Original signed delivery with durable processing state.
#[derive(Clone, Debug)]
pub struct Delivery {
    /// GitHub delivery UUID; not a generated entity ID.
    pub id: Uuid,
    /// Validated GitHub event header, including unknown events.
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
    /// Safe typed failure category; no raw provider errors.
    pub last_failure: Option<Failure>,
}

/// Queue statements only; workers own scheduling and handler policy.
#[unimock::unimock(api = GitHubDeliveriesMock)]
pub trait GitHubDeliveries {
    /// Read a delivery for idempotency or fenced completion.
    fn github_delivery(&mut self, id: Uuid) -> Result<Option<Delivery>>;
    /// Persist accepted bytes or a policy-approved state transition.
    fn save_github_delivery(&mut self, value: &Delivery) -> Result<()>;
    /// Atomically claim one due delivery with SKIP LOCKED.
    fn claim_github_delivery(
        &mut self,
        now: DateTime<Utc>,
        lease: Uuid,
        until: DateTime<Utc>,
    ) -> Result<Option<Delivery>>;
    /// Mark exhausted crashed deliveries failed before claiming work.
    fn expire_github_deliveries(&mut self, now: DateTime<Utc>) -> Result<()>;
}
