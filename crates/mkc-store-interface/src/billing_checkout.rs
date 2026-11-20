//! Durable Checkout request persistence boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;
use uuid::Uuid;

use crate::error::Result;

/// One exact Checkout request reserved for an organization.
#[derive(Clone, Debug)]
pub struct BillingCheckoutSession {
    /// Stable command identity copied into Stripe metadata.
    pub id: Uuid,
    /// Organization allowed to complete this Checkout.
    pub organization_id: OrganizationId,
    /// Existing provider customer used by the request.
    pub provider_customer_id: String,
    /// Verified Editor price identifier.
    pub editor_price_id: String,
    /// Editor quantity captured when the request was reserved.
    pub editor_quantity: i32,
    /// Verified Collaborator price identifier.
    pub collaborator_price_id: String,
    /// Collaborator quantity captured when the request was reserved.
    pub collaborator_quantity: i32,
    /// Trial offered by this request, when the organization was eligible.
    pub trial_period_days: Option<i32>,
    /// Exact successful-return URL.
    pub success_url: String,
    /// Exact abandoned-return URL.
    pub cancel_url: String,
    /// Provider expiry after which a replacement may be reserved.
    pub expires_at: DateTime<Utc>,
    /// Stable provider idempotency key.
    pub idempotency_key: String,
    /// Provider session identity after a successful request.
    pub provider_session_id: Option<String>,
    /// Provider-hosted URL after a successful request.
    pub provider_session_url: Option<String>,
    /// Initial reservation time.
    pub created_at: DateTime<Utc>,
    /// Monotonic record version.
    pub version: i64,
}

/// Queries for durable Checkout requests.
#[unimock::unimock(api = BillingCheckoutSessionsMock)]
pub trait BillingCheckoutSessions {
    /// Read the current request for an organization.
    fn billing_checkout_session(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Option<BillingCheckoutSession>>;
    /// Insert a request or return the concurrently reserved request.
    fn reserve_billing_checkout_session(
        &mut self,
        candidate: &BillingCheckoutSession,
    ) -> Result<BillingCheckoutSession>;
    /// Store provider completion for the matching request identity.
    fn save_billing_checkout_session(&mut self, value: &BillingCheckoutSession) -> Result<()>;
    /// Delete only the matching request identity.
    fn delete_billing_checkout_session(&mut self, id: Uuid) -> Result<()>;
}
