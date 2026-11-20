//! Durable, leased billing seat-command persistence boundary.

use std::result;
use std::str::FromStr;

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use thiserror::Error;
use uuid::Uuid;

use crate::error::Result;

/// Provider operation retained by a seat command.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SeatCommandOperation {
    /// Add a subscription item.
    Create,
    /// Change an existing item quantity.
    Update,
    /// Remove an existing item.
    Delete,
}

impl SeatCommandOperation {
    /// Stable SQL representation.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Update => "update",
            Self::Delete => "delete",
        }
    }
}

/// Invalid persisted seat-command operation.
#[derive(Debug, Error)]
#[error("[mkc-store-interface/billing_seat_command] invalid operation")]
pub struct ParseOperationError;

impl FromStr for SeatCommandOperation {
    type Err = ParseOperationError;

    fn from_str(value: &str) -> result::Result<Self, Self::Err> {
        match value {
            "create" => Ok(Self::Create),
            "update" => Ok(Self::Update),
            "delete" => Ok(Self::Delete),
            _ => Err(ParseOperationError),
        }
    }
}

/// One exact provider mutation waiting for webhook confirmation.
#[derive(Clone, Debug)]
pub struct BillingSeatCommand {
    /// Stable command identity used by provider idempotency.
    pub id: Uuid,
    /// Organization whose subscription is changing.
    pub organization_id: OrganizationId,
    /// Derived seat kind this command owns.
    pub seat_kind: SeatKind,
    /// Provider subscription identity captured before the write.
    pub provider_subscription_id: String,
    /// Exact provider operation.
    pub operation: SeatCommandOperation,
    /// Existing provider item for updates and deletion.
    pub provider_item_id: Option<String>,
    /// Verified price identity captured for creation and auditing.
    pub price_id: String,
    /// Requested confirmed quantity; zero means deletion.
    pub quantity: i32,
    /// Stable key reused by create and update retries.
    pub idempotency_key: String,
    /// Earliest instant another attempt may claim the command.
    pub due_at: DateTime<Utc>,
    /// Number of provider attempts claimed.
    pub attempts: i32,
    /// Current worker lease token.
    pub lease: Option<Uuid>,
    /// Instant after which another worker may reclaim the command.
    pub lease_until: Option<DateTime<Utc>>,
    /// Initial reservation time.
    pub created_at: DateTime<Utc>,
}

/// Queries for one pending command per organization and seat kind.
#[unimock::unimock(api = BillingSeatCommandsMock)]
pub trait BillingSeatCommands {
    /// Read one pending command.
    fn billing_seat_command(
        &mut self,
        organization: OrganizationId,
        kind: SeatKind,
    ) -> Result<Option<BillingSeatCommand>>;
    /// List an organization's pending commands.
    fn billing_seat_commands(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Vec<BillingSeatCommand>>;
    /// Insert a command or return the concurrently reserved command.
    fn reserve_billing_seat_command(
        &mut self,
        candidate: &BillingSeatCommand,
    ) -> Result<BillingSeatCommand>;
    /// Claim a due command if it has no live lease.
    fn claim_billing_seat_command(
        &mut self,
        id: Uuid,
        lease: Uuid,
        now: DateTime<Utc>,
        lease_until: DateTime<Utc>,
    ) -> Result<Option<BillingSeatCommand>>;
    /// Schedule a retry only when the caller still owns the lease.
    fn release_billing_seat_command(
        &mut self,
        id: Uuid,
        lease: Uuid,
        due_at: DateTime<Utc>,
    ) -> Result<bool>;
    /// Delete a confirmed command by identity.
    fn delete_billing_seat_command(&mut self, id: Uuid) -> Result<()>;
}
