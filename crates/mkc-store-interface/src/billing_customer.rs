//! Billing customer persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;

use crate::error::Result;

/// Stripe customer identity owned by one organization.
#[derive(Clone, Debug)]
pub struct BillingCustomer {
    /// Owning organization.
    pub organization_id: OrganizationId,
    /// Stable Stripe customer identifier.
    pub provider_customer_id: String,
    /// First observed use of the organization's one-time trial.
    pub trial_used_at: Option<DateTime<Utc>>,
    /// Initial persistence time.
    pub created_at: DateTime<Utc>,
    /// Monotonic record version.
    pub version: i64,
}

/// Queries for organization billing customers.
#[unimock::unimock(api = BillingCustomersMock)]
pub trait BillingCustomers {
    /// Read the customer owned by an organization.
    fn billing_customer(&mut self, organization: OrganizationId)
    -> Result<Option<BillingCustomer>>;
    /// Read a customer by its provider identifier.
    fn billing_customer_by_provider_id(
        &mut self,
        provider_customer_id: &str,
    ) -> Result<Option<BillingCustomer>>;
    /// Insert or replace the customer state for an organization.
    fn save_billing_customer(&mut self, value: &BillingCustomer) -> Result<()>;
}
