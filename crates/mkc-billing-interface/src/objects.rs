//! Typed Stripe objects retained at the provider boundary.
//!
//! Each DTO keeps unknown provider fields only in its flattened `extra` map so
//! schema drift does not discard evidence. `EventData::object` is the sole
//! additional untyped value because event-specific decoding belongs to the
//! webhook handler after signature verification and durable acceptance.

use std::collections::BTreeMap;

use serde::Deserialize;
use serde_json::Value;

use crate::catalogue::{ExpandableProduct, Recurring, TaxBehavior};

/// Stripe list envelope.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct List<T> {
    /// Provider object discriminator, normally `list`.
    pub object: String,
    /// Typed objects on this page.
    pub data: Vec<T>,
    /// Whether another cursor page is available, or `None` when omitted.
    #[serde(default)]
    pub has_more: Option<bool>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Stripe customer associated with one Mokly organization.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Customer {
    /// Stable Stripe customer identifier.
    pub id: String,
    /// Caller-supplied ownership metadata.
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Subscription status values known to the pinned Stripe API version.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    /// Trial access before the first invoice.
    Trialing,
    /// Paid and current.
    Active,
    /// Payment is overdue but access remains live.
    PastDue,
    /// Subscription has ended.
    Canceled,
    /// Latest invoice remains unpaid.
    Unpaid,
    /// Initial payment has not completed.
    Incomplete,
    /// Initial payment did not complete before expiry.
    IncompleteExpired,
    /// Trial ended without a payment method.
    Paused,
    /// A status introduced after the pinned contract.
    #[serde(other)]
    Unknown,
}

/// Minimal price identity nested in a subscription item.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct PriceRef {
    /// Stable Stripe price identifier.
    pub id: String,
    /// Stable catalogue lookup key when this price currently owns one.
    #[serde(default)]
    pub lookup_key: Option<String>,
    /// Catalogue identity metadata retained by historical prices.
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// One licensed recurring line on a subscription.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct SubscriptionItem {
    /// Stable Stripe subscription-item identifier.
    pub id: String,
    /// Price assigned to this line.
    pub price: PriceRef,
    /// Licensed seat quantity.
    pub quantity: i64,
    /// Item-level period end as Unix seconds under the pinned API version.
    pub current_period_end: i64,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Invoice lifecycle values known to the pinned Stripe API version.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    /// Invoice has not been finalized.
    Draft,
    /// Finalized invoice remains payable.
    Open,
    /// Invoice has been paid.
    Paid,
    /// Invoice was closed without collection.
    Uncollectible,
    /// Invoice was voided.
    Void,
    /// A status introduced after the pinned contract.
    #[serde(other)]
    Unknown,
}

/// Stripe invoice fields needed to derive canonical payment state.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Invoice {
    /// Stable Stripe invoice identifier.
    pub id: String,
    /// Whether Stripe has attempted to collect this invoice.
    pub attempted: bool,
    /// Current invoice lifecycle state.
    pub status: Option<InvoiceStatus>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Stripe expandable invoice relation.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ExpandableInvoice {
    /// Unexpanded invoice identifier.
    Id(String),
    /// Expanded invoice object.
    Object(Invoice),
}

/// Stripe subscription used to derive the local plan.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Subscription {
    /// Stable Stripe subscription identifier.
    pub id: String,
    /// Stable Stripe customer identifier.
    pub customer: String,
    /// Provider lifecycle state.
    pub status: SubscriptionStatus,
    /// Expanded subscription items.
    pub items: List<SubscriptionItem>,
    /// Whether Stripe will end the subscription after the current period.
    pub cancel_at_period_end: bool,
    /// Trial end as Unix seconds when a trial exists.
    pub trial_end: Option<i64>,
    /// Most recent invoice, expanded on canonical subscription reads.
    pub latest_invoice: Option<ExpandableInvoice>,
    /// Caller-supplied ownership metadata.
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Stripe price used by runtime retrieval and catalogue operations.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Price {
    /// Stable Stripe price identifier.
    pub id: String,
    /// Provider creation time as Unix seconds.
    pub created: i64,
    /// Product relation, expanded for lookup-key catalogue reads.
    pub product: ExpandableProduct,
    /// Price in the currency's minor unit, absent for custom amounts.
    pub unit_amount: Option<i64>,
    /// Lowercase ISO currency code.
    pub currency: String,
    /// Recurrence terms when this is a recurring price.
    pub recurring: Option<Recurring>,
    /// Whether Stripe permits new purchases of this price.
    pub active: bool,
    /// Stable catalogue lookup key when assigned.
    pub lookup_key: Option<String>,
    /// Operator-facing description of the price.
    pub nickname: Option<String>,
    /// Provider tax treatment, absent only on legacy or partial objects.
    pub tax_behavior: Option<TaxBehavior>,
    /// Catalogue identity metadata.
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Hosted Checkout session returned to the browser.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct CheckoutSession {
    /// Stable Stripe Checkout session identifier.
    pub id: String,
    /// Hosted Checkout URL when Stripe supplied one.
    pub url: Option<String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Hosted Customer Portal session returned to the browser.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct PortalSession {
    /// Stable Stripe portal session identifier.
    pub id: String,
    /// Hosted Customer Portal URL.
    pub url: String,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Raw event payload retained until a typed handler selects its schema.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct EventData {
    /// Event-specific Stripe object.
    pub object: Value,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Signed Stripe event envelope.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Event {
    /// Stable Stripe event identifier.
    pub id: String,
    /// Provider event name.
    #[serde(rename = "type")]
    pub type_: String,
    /// Provider creation time as Unix seconds.
    pub created: i64,
    /// Event payload selected by `type_`.
    pub data: EventData,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

impl Event {
    /// Classify this event without rejecting future provider event names.
    pub fn kind(&self) -> EventKind {
        EventKind::from_type(&self.type_)
    }
}

/// Event names with typed billing handlers.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventKind {
    /// Checkout completed and may bind a customer and subscription.
    CheckoutSessionCompleted,
    /// A subscription was created.
    CustomerSubscriptionCreated,
    /// A subscription was updated.
    CustomerSubscriptionUpdated,
    /// A subscription was deleted.
    CustomerSubscriptionDeleted,
    /// An invoice was paid.
    InvoicePaid,
    /// An invoice payment failed.
    InvoicePaymentFailed,
    /// An event intentionally retained without a typed handler.
    Unknown,
}

impl EventKind {
    /// Map a provider event name to the known handler catalogue.
    pub fn from_type(value: &str) -> Self {
        match value {
            "checkout.session.completed" => Self::CheckoutSessionCompleted,
            "customer.subscription.created" => Self::CustomerSubscriptionCreated,
            "customer.subscription.updated" => Self::CustomerSubscriptionUpdated,
            "customer.subscription.deleted" => Self::CustomerSubscriptionDeleted,
            "invoice.paid" => Self::InvoicePaid,
            "invoice.payment_failed" => Self::InvoicePaymentFailed,
            _ => Self::Unknown,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/objects_tests.rs"]
mod tests;
