//! Billing subscription and seat-item persistence boundaries.

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use uuid::Uuid;

use crate::billing_state::SubscriptionStatus;
use crate::error::Result;

/// Latest provider subscription facts for one organization.
#[derive(Clone, Debug)]
pub struct BillingSubscription {
    /// Owning organization.
    pub organization_id: OrganizationId,
    /// Stable Stripe subscription identifier.
    pub provider_subscription_id: String,
    /// Latest typed provider status.
    pub status: SubscriptionStatus,
    /// Period end shared by the subscription's items.
    pub current_period_end: Option<DateTime<Utc>>,
    /// Trial end when the subscription is trialing.
    pub trial_end: Option<DateTime<Utc>>,
    /// Whether Stripe will cancel at the current period end.
    pub cancel_at_period_end: bool,
    /// Latest payment-failed fact, cleared by a paid invoice.
    pub payment_failed_at: Option<DateTime<Utc>>,
    /// Provider invoice event time used to reject stale payment reconciliation.
    pub payment_updated_at: Option<DateTime<Utc>>,
    /// Provider update time used to reject stale reconciliation.
    pub updated_at: DateTime<Utc>,
    /// Last time seat reconciliation examined this organization.
    pub seats_checked_at: Option<DateTime<Utc>>,
    /// Monotonic record version.
    pub version: i64,
}

/// One provider item for an organization's derived seat kind.
#[derive(Clone, Debug)]
pub struct BillingSubscriptionItem {
    /// Stable cloud record identifier.
    pub id: Uuid,
    /// Organization whose subscription owns this item.
    pub organization_id: OrganizationId,
    /// Derived seat category billed by the item.
    pub seat_kind: SeatKind,
    /// Stable Stripe subscription-item identifier.
    pub provider_item_id: String,
    /// Provider price identifier currently carried by this subscription item.
    pub price_id: String,
    /// Quantity most recently reported by Stripe.
    pub quantity: i32,
}

/// Queries for organization subscriptions and their seat items.
#[unimock::unimock(api = BillingSubscriptionsMock)]
pub trait BillingSubscriptions {
    /// Read the subscription owned by an organization.
    fn billing_subscription(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Option<BillingSubscription>>;
    /// Read a subscription by its provider identifier.
    fn billing_subscription_by_provider_id(
        &mut self,
        provider_subscription_id: &str,
    ) -> Result<Option<BillingSubscription>>;
    /// List live subscriptions in stable reconciliation order.
    fn live_billing_subscriptions(&mut self, limit: i64) -> Result<Vec<BillingSubscription>>;
    /// Record when one organization's seat state was examined.
    fn mark_seats_checked(
        &mut self,
        organization: OrganizationId,
        checked_at: DateTime<Utc>,
    ) -> Result<()>;
    /// Insert or replace the subscription state for an organization.
    fn save_billing_subscription(&mut self, value: &BillingSubscription) -> Result<()>;
    /// Delete an organization's subscription and its items.
    fn delete_billing_subscription(&mut self, organization: OrganizationId) -> Result<()>;
    /// List both possible seat items for an organization.
    fn billing_subscription_items(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Vec<BillingSubscriptionItem>>;
    /// Insert or replace one subscription item.
    fn save_billing_subscription_item(&mut self, value: &BillingSubscriptionItem) -> Result<()>;
    /// Delete one subscription item.
    fn delete_billing_subscription_item(&mut self, id: Uuid) -> Result<()>;
}
