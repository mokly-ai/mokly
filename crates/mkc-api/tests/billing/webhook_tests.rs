//! Signature failures and rate-limited delivery retries through the real adapters.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_billing::recovery::{BillingRecovery, StoreBillingRecovery};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::Plan;
use mkc_store_interface::billing_state::BillingFailure;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::harness::Harness;

#[test]
fn webhook_rejects_missing_forged_stale_and_invalid_envelopes() {
    let Some(app) = Harness::start() else {
        return;
    };
    let body = app.event_body("evt_signature1", "invoice.paid", json!({}));
    let forged = app.webhook(body.clone(), app.runtime.now().timestamp(), false);
    let forged = app.json(forged, 401);
    assert_eq!(forged["error"]["reason"], "webhook-signature-invalid");
    let missing = app
        .anonymous(Method::POST, "/v1/billing/webhooks")
        .header("Content-Type", "application/json")
        .body(body.clone())
        .send()
        .unwrap();
    let missing = app.json(missing, 400);
    assert_eq!(missing["error"]["reason"], "validation-failed");
    let stale = app.webhook(body, app.runtime.now().timestamp() - 301, true);
    let stale = app.json(stale, 401);
    assert_eq!(stale["error"]["reason"], "webhook-signature-invalid");
    let invalid = br#"{"id":"evt_invalid1","created":1}"#.to_vec();
    let invalid_response = app.webhook(invalid, app.runtime.now().timestamp(), true);
    let invalid_response = app.json(invalid_response, 400);
    assert_eq!(invalid_response["error"]["reason"], "validation-failed");
    app.accept_event("evt_unknown1", "customer.created", json!({}));
    app.wait_delivery("evt_unknown1", DeliveryStatus::Ignored);
    app.accept_event("evt_malformed1", "customer.subscription.updated", json!({}));
    let malformed = app.wait_delivery("evt_malformed1", DeliveryStatus::Failed);
    assert_eq!(malformed.last_failure, Some(BillingFailure::Malformed));
    assert_eq!(malformed.attempts, 1);
    app.assert_no_server_errors();
}

#[test]
fn rate_limited_retrieval_retries_after_the_injected_clock_advances() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = app.json(
        app.request(Method::POST, "/v1/workspaces")
            .json(&json!({"name":"Retry team","slug":"retry-team"}))
            .send()
            .unwrap(),
        201,
    );
    let workspace_id = workspace["id"].as_str().unwrap();
    app.json(
        app.request(
            Method::POST,
            &format!("/v1/workspaces/{workspace_id}/billing/checkout"),
        )
        .json(&json!({}))
        .send()
        .unwrap(),
        201,
    );
    app.stripe.set_subscription("active", false);
    app.stripe.fail_next_retrieval();
    let body = app.event_body(
        "evt_ratelimit1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
    );
    let response = app.webhook(body, app.runtime.now().timestamp(), true);
    app.body(response, 202);
    let pending = app.wait_delivery_attempts("evt_ratelimit1", DeliveryStatus::Pending, 1);
    assert_eq!(pending.last_failure, Some(BillingFailure::RateLimited));
    assert_eq!(
        pending.due_at.timestamp(),
        app.runtime.now().timestamp() + 5
    );
    app.runtime.advance(5);
    app.wait_delivery("evt_ratelimit1", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .organization(OrganizationId(Uuid::parse_str(workspace_id).unwrap()))
                .unwrap()
                .unwrap()
                .plan,
            Plan::Team
        );
    });
    let retrieves = app
        .stripe
        .calls()
        .into_iter()
        .filter(|call| call.method == "GET" && call.path == "/v1/subscriptions/sub_fixture")
        .count();
    assert_eq!(retrieves, 2);

    app.stripe.fail_next_retrieval();
    let body = app.event_body(
        "evt_exhausted1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
    );
    let response = app.webhook(body, app.runtime.now().timestamp(), true);
    app.body(response, 202);
    app.wait_delivery_attempts("evt_exhausted1", DeliveryStatus::Pending, 1);
    app.stripe.fail_next_retrieval();
    app.queries(&mut |queries| {
        let mut delivery = queries.billing_delivery("evt_exhausted1").unwrap().unwrap();
        delivery.attempts = 7;
        queries.save_billing_delivery(&delivery).unwrap();
    });
    app.runtime.advance(5);
    let failed = app.wait_delivery("evt_exhausted1", DeliveryStatus::Failed);
    assert_eq!(failed.attempts, 8);
    assert_eq!(failed.last_failure, Some(BillingFailure::RateLimited));
    let recovery_runtime: Arc<dyn Runtime> = app.runtime.clone();
    let recovery: &dyn BillingRecovery = &StoreBillingRecovery {
        store: app.store.clone(),
        runtime: recovery_runtime,
    };
    assert_eq!(recovery.dead_letters().unwrap(), 1);
    assert!(recovery.requeue("evt_exhausted1").unwrap());
    app.wait_delivery("evt_exhausted1", DeliveryStatus::Done);
    assert_eq!(recovery.dead_letters().unwrap(), 0);
    app.assert_no_server_errors();
}
