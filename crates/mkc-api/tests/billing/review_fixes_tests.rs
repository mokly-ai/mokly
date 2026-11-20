//! Billing review regressions across the API, workers, Postgres, and recorded Stripe.

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_domain::values::Plan;
use mkc_store_interface::billing_state::BillingFailure;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;

use super::harness::Harness;
use super::lifecycle_support::accept;
use super::review_fixes_support::{
    assert_checkout_lifetime, checkout_calls, create_workspace, editor_quantity,
    editor_update_keys, field, invite_editor, live_workspace, parse_workspace, session_id,
};

#[test]
fn checkout_presses_reuse_one_provider_session_until_its_expiry() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = create_workspace(&app, "Checkout reservation");
    let path = format!("/v1/workspaces/{workspace}/billing/checkout");
    let first_requested_at = app.runtime.now();
    let first = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    app.runtime.advance(Duration::minutes(20).num_seconds());
    let second = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    let calls = checkout_calls(&app);
    assert_eq!(calls.len(), 1);
    assert_checkout_lifetime(&calls[0], first_requested_at);
    assert_eq!(first["url"], second["url"]);
    assert_eq!(session_id(&first), session_id(&second));

    app.runtime.advance(Duration::minutes(40).num_seconds());
    let replacement_at = app.runtime.now();
    let replacement = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    let calls = checkout_calls(&app);
    assert_eq!(calls.len(), 2);
    assert_ne!(calls[1].idempotency_key, calls[0].idempotency_key);
    assert_ne!(replacement["url"], first["url"]);
    assert_checkout_lifetime(&calls[1], replacement_at);
    app.assert_no_server_errors();
}

#[test]
fn outcome_unknown_checkout_replays_exact_parameters_after_seats_change() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = create_workspace(&app, "Checkout recovery");
    let path = format!("/v1/workspaces/{workspace}/billing/checkout");
    app.stripe.lose_next_checkout_response();
    let failure = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        503,
    );
    assert_eq!(failure["error"]["reason"], "unavailable");
    invite_editor(&app, &workspace);
    app.runtime.advance(1);
    app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    let calls = checkout_calls(&app);
    assert_eq!(calls.len(), 2);
    assert_eq!(calls[1].idempotency_key, calls[0].idempotency_key);
    assert_eq!(calls[1].form, calls[0].form);
    assert_eq!(field(&calls[1], "line_items[0][quantity]"), Some("1"));
}

#[test]
fn completed_checkout_is_returned_without_another_provider_write() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = create_workspace(&app, "Checkout stored URL");
    let path = format!("/v1/workspaces/{workspace}/billing/checkout");
    let first = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    app.stripe.fail_next_checkout();
    let replay = app.json(
        app.request(Method::POST, &path)
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    assert_eq!(first["url"], replay["url"]);
    assert_eq!(checkout_calls(&app).len(), 1);
}

#[test]
fn oscillating_editor_count_finishes_at_the_latest_quantity() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Seat oscillation", "evt_oscstart");

    let first_member = invite_editor(&app, &workspace);
    assert!(app.run_seats());
    assert_eq!(editor_quantity(&app), 2);
    let first_key = editor_update_keys(&app).pop().unwrap();
    app.body(
        app.request(
            Method::DELETE,
            &format!("/v1/workspaces/{workspace}/members/{first_member}"),
        )
        .json(&json!({"version":2}))
        .send()
        .unwrap(),
        204,
    );
    assert!(app.run_seats());
    assert_eq!(editor_quantity(&app), 2);
    assert_eq!(editor_update_keys(&app), vec![first_key.clone()]);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_osctwo",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    assert!(app.run_seats());
    assert_eq!(editor_quantity(&app), 1);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_oscone",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );

    invite_editor(&app, &workspace);
    assert!(app.run_seats());
    assert_eq!(editor_quantity(&app), 2);
    let keys = editor_update_keys(&app);
    assert_eq!(keys.len(), 3);
    assert_ne!(keys[0], keys[2]);
    assert_eq!(keys[0], first_key);
    app.assert_no_server_errors();
}

#[test]
fn second_live_subscription_is_retained_as_a_conflict() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Conflict guard", "evt_boundstart");
    app.runtime.advance(1);
    app.accept_event(
        "evt_conflictingsub",
        "customer.subscription.created",
        json!({"id":"sub_conflicting","customer":"cus_fixture"}),
    );
    let delivery = app.wait_delivery("evt_conflictingsub", DeliveryStatus::Failed);
    assert_eq!(delivery.attempts, 1);
    assert_eq!(delivery.last_failure, Some(BillingFailure::Conflict));
    app.queries(&mut |queries| {
        let subscription = queries
            .billing_subscription(parse_workspace(&workspace))
            .unwrap()
            .unwrap();
        assert_eq!(subscription.provider_subscription_id, "sub_fixture");
        assert!(subscription.status.is_live());
        assert_eq!(
            queries
                .organization(parse_workspace(&workspace))
                .unwrap()
                .unwrap()
                .plan,
            Plan::Team
        );
    });
    app.assert_no_server_errors();
}
