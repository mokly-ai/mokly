//! Full billing lifecycle through the public API, Postgres, workers and recorded Stripe.

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::Plan;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use super::harness::Harness;
use super::lifecycle_support::{
    accept, assert_cancel_contract, assert_checkout_contract, assert_collaborator_request,
    assert_free_private_transition_is_refused, assert_seat_change_requests, invite_reviewer,
};

#[test]
fn recorded_app_completes_the_billing_lifecycle() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = app.json(
        app.request(Method::POST, "/v1/workspaces")
            .json(&json!({"name":"Billing lifecycle", "slug":"billing-lifecycle"}))
            .send()
            .unwrap(),
        201,
    );
    let workspace_id = workspace["id"].as_str().unwrap();
    let billing_path = format!("/v1/workspaces/{workspace_id}/billing");
    let billing = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(billing["plan"], "free");
    assert_eq!(
        billing["seats"][0],
        json!({"kind":"editor","inUse":1,"unitAmountCents":2000})
    );
    assert_eq!(
        billing["seats"][1],
        json!({"kind":"collaborator","inUse":0,"unitAmountCents":500})
    );
    assert_eq!(billing["subscription"], Value::Null);
    assert_eq!(billing["manageable"], true);
    assert_eq!(billing["checkoutAvailable"], true);

    let checkout = app.json(
        app.request(Method::POST, &format!("{billing_path}/checkout"))
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    assert_eq!(
        checkout["url"],
        "https://checkout.stripe.test/c/pay/cs_test_fixture"
    );
    let portal = app.json(
        app.request(Method::POST, &format!("{billing_path}/portal"))
            .json(&json!({}))
            .send()
            .unwrap(),
        201,
    );
    assert_eq!(
        portal["url"],
        "https://billing.stripe.test/session/bps_fixture"
    );
    assert_checkout_contract(&app, workspace_id, "billing-lifecycle");

    app.runtime.advance(1);
    accept(
        &app,
        "evt_checkout1",
        "checkout.session.completed",
        json!({
            "customer":"cus_fixture",
            "subscription":"sub_fixture",
            "client_reference_id":workspace_id
        }),
        DeliveryStatus::Done,
    );
    app.runtime.advance(1);
    accept(
        &app,
        "evt_created1",
        "customer.subscription.created",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .organization(OrganizationId(Uuid::parse_str(workspace_id).unwrap()))
                .unwrap()
                .unwrap()
                .plan,
            Plan::Team
        );
        assert!(
            queries
                .billing_customer(OrganizationId(Uuid::parse_str(workspace_id).unwrap()))
                .unwrap()
                .unwrap()
                .trial_used_at
                .is_some()
        );
    });
    let refused = app.json(
        app.request(Method::POST, &format!("{billing_path}/checkout"))
            .json(&json!({}))
            .send()
            .unwrap(),
        400,
    );
    assert_eq!(refused["error"]["reason"], "subscription-active");

    let reviewer_member = invite_reviewer(&app, workspace_id);
    assert!(app.run_seats());
    assert_collaborator_request(&app, workspace_id);
    app.stripe.set_subscription("active", false);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_updated1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.json(
        app.request(
            Method::PATCH,
            &format!("/v1/workspaces/{workspace_id}/members/{reviewer_member}"),
        )
        .json(&json!({"role":"member","version":2}))
        .send()
        .unwrap(),
        200,
    );
    assert!(app.run_seats());
    assert_seat_change_requests(&app, workspace_id);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_seats2",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    let mut version = 0;
    app.queries(&mut |queries| {
        version = queries
            .billing_subscription(OrganizationId(Uuid::parse_str(workspace_id).unwrap()))
            .unwrap()
            .unwrap()
            .version;
    });
    let stale = app.event_body_at(
        "evt_stale1",
        "customer.subscription.updated",
        app.runtime.now().timestamp() - 10,
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
    );
    let response = app.webhook(stale, app.runtime.now().timestamp(), true);
    app.body(response, 202);
    app.wait_delivery("evt_stale1", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .billing_subscription(OrganizationId(Uuid::parse_str(workspace_id).unwrap()))
                .unwrap()
                .unwrap()
                .version,
            version
        );
    });

    app.runtime.advance(1);
    let failed_at = app.runtime.now();
    app.stripe.set_payment_failed();
    accept(
        &app,
        "evt_invoicefailed1",
        "invoice.payment_failed",
        json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
        DeliveryStatus::Done,
    );
    let billing = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(billing["subscription"]["status"], "active");
    assert_eq!(
        billing["subscription"]["paymentFailedAt"]
            .as_str()
            .unwrap()
            .parse::<chrono::DateTime<chrono::Utc>>()
            .unwrap()
            .timestamp(),
        failed_at.timestamp()
    );
    app.runtime.advance(1);
    app.stripe.set_payment_paid();
    accept(
        &app,
        "evt_invoicepaid1",
        "invoice.paid",
        json!({
            "customer":"cus_fixture",
            "parent":{"subscription_details":{"subscription":"sub_fixture"}}
        }),
        DeliveryStatus::Done,
    );
    let billing = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(billing["subscription"]["paymentFailedAt"], Value::Null);

    app.stripe.set_subscription("active", true);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_ending1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    let billing = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(billing["subscription"]["cancelAtPeriodEnd"], true);

    app.stripe.set_subscription("canceled", false);
    app.runtime.advance(1);
    let deleted_body = app.accept_event(
        "evt_deleted1",
        "customer.subscription.deleted",
        app.stripe.subscription_object(),
    );
    app.wait_delivery("evt_deleted1", DeliveryStatus::Done);
    let billing = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(billing["plan"], "free");
    assert_eq!(billing["checkoutAvailable"], true);
    let replay = app.webhook(deleted_body.clone(), app.runtime.now().timestamp(), true);
    app.body(replay, 202);
    let mut mismatch = deleted_body;
    mismatch.push(b' ');
    let mismatch = app.webhook(mismatch, app.runtime.now().timestamp(), true);
    let mismatch = app.json(mismatch, 400);
    assert_eq!(mismatch["error"]["reason"], "validation-failed");

    assert_free_private_transition_is_refused(&app, workspace_id);
    app.stripe.set_subscription("active", false);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_reactivated1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    let workspace = app.json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace_id}"))
            .send()
            .unwrap(),
        200,
    );
    app.body(
        app.request(Method::DELETE, &format!("/v1/workspaces/{workspace_id}"))
            .json(&json!({
                "version":workspace["version"],
                "confirmationName":"Billing lifecycle"
            }))
            .send()
            .unwrap(),
        204,
    );
    assert_cancel_contract(&app);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_afterdelete1",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Ignored,
    );
    app.assert_no_server_errors();
}
