//! Provider operations used by checkout, webhooks, and seat reconciliation.

use std::collections::BTreeMap;

use crate::error::Result;
use crate::objects::{
    CheckoutSession, Customer, PortalSession, Price, Subscription, SubscriptionItem,
};

/// Customer creation inputs for one organization.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCustomer {
    /// Organization display name shown by Stripe.
    pub name: String,
    /// Billing contact email.
    pub email: String,
    /// Ownership metadata, including `organization_id`.
    pub metadata: BTreeMap<String, String>,
}

/// One recurring price and licensed quantity in Checkout.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LineItem {
    /// Startup-verified Stripe price identifier.
    pub price: String,
    /// Positive licensed quantity.
    pub quantity: i64,
}

/// Hosted Checkout creation inputs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateCheckout {
    /// Existing Stripe customer identifier.
    pub customer: String,
    /// Stable organization reference used for reconciliation and idempotency.
    pub client_reference_id: String,
    /// Browser destination after successful Checkout.
    pub success_url: String,
    /// Browser destination after abandoned Checkout.
    pub cancel_url: String,
    /// Editor and optional Collaborator recurring lines.
    pub line_items: Vec<LineItem>,
    /// Trial length when the organization remains eligible.
    pub trial_period_days: Option<u32>,
    /// Whether Checkout enables automatic tax.
    pub automatic_tax: bool,
    /// Whether Checkout requires a billing address.
    pub collect_billing_address: bool,
    /// Whether Checkout saves the billing address to the customer.
    pub save_customer_address: bool,
    /// Unix instant one hour after durable reservation.
    pub expires_at: Option<i64>,
    /// Ownership metadata, including `organization_id`.
    pub metadata: BTreeMap<String, String>,
    /// Key shared by requests in one bounded Checkout window.
    pub idempotency_key: String,
}

/// Provider-independent billing behavior consumed by application services.
#[unimock::unimock(api = BillingProviderMock)]
pub trait BillingProvider: Send + Sync {
    /// Create the customer for an organization.
    fn create_customer(&self, input: &CreateCustomer) -> Result<Customer>;
    /// Create a subscription-mode hosted Checkout session.
    fn create_checkout_session(&self, input: &CreateCheckout) -> Result<CheckoutSession>;
    /// Create a hosted Customer Portal session under a key unique to this request.
    fn create_portal_session(
        &self,
        customer: &str,
        return_url: &str,
        idempotency_key: &str,
    ) -> Result<PortalSession>;
    /// Retrieve a subscription with its items and latest invoice expanded.
    fn retrieve_subscription(&self, id: &str) -> Result<Subscription>;
    /// Cancel a subscription immediately.
    fn cancel_subscription(&self, id: &str) -> Result<Subscription>;
    /// Add a recurring item to a subscription.
    fn create_subscription_item(
        &self,
        subscription: &str,
        price: &str,
        quantity: i64,
        idempotency_key: &str,
    ) -> Result<SubscriptionItem>;
    /// Replace the licensed quantity on a subscription item.
    fn update_subscription_item(
        &self,
        item: &str,
        quantity: i64,
        idempotency_key: &str,
    ) -> Result<SubscriptionItem>;
    /// Remove a subscription item.
    fn delete_subscription_item(&self, item: &str) -> Result<()>;
    /// List active prices for one to ten unique Stripe lookup keys.
    fn list_prices_by_lookup_keys(&self, lookup_keys: &[String]) -> Result<Vec<Price>>;
}

#[cfg(test)]
#[path = "_tests_/provider_tests.rs"]
mod tests;
