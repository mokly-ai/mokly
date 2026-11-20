//! Durable Checkout records reproduce every provider parameter exactly.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use chrono::{Duration, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_checkout::BillingCheckoutSession;
use uuid::Uuid;

use super::provider_request;

#[test]
fn stored_checkout_becomes_the_exact_provider_request() {
    let now = Utc::now();
    let id = Uuid::from_u128(2);
    let workspace = OrganizationId(Uuid::from_u128(1));
    let stored = BillingCheckoutSession {
        id,
        organization_id: workspace,
        provider_customer_id: "cus_fixture".into(),
        editor_price_id: "price_editor".into(),
        editor_quantity: 3,
        collaborator_price_id: "price_collaborator".into(),
        collaborator_quantity: 2,
        trial_period_days: Some(7),
        success_url: "https://app.test/success".into(),
        cancel_url: "https://app.test/cancel".into(),
        expires_at: now + Duration::hours(1),
        idempotency_key: format!("checkout:{id}"),
        provider_session_id: None,
        provider_session_url: None,
        created_at: now,
        version: 1,
    };
    let request = provider_request(&stored).unwrap();
    assert_eq!(request.customer, stored.provider_customer_id);
    assert_eq!(request.line_items[0].quantity, 3);
    assert_eq!(request.line_items[1].quantity, 2);
    assert_eq!(request.trial_period_days, Some(7));
    assert_eq!(request.expires_at, Some(stored.expires_at.timestamp()));
    assert_eq!(request.idempotency_key, stored.idempotency_key);
    assert_eq!(request.metadata["organization_id"], workspace.to_string());
    assert_eq!(request.metadata["checkout_session_id"], id.to_string());
}
