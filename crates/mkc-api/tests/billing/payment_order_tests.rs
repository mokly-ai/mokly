//! Payment-state ordering regressions across Stripe, workers, and Postgres.

use mkc_auth::runtime::Runtime;
use mkc_store_interface::github_state::DeliveryStatus;
use serde_json::json;

use super::harness::Harness;
use super::lifecycle_support::accept;
use super::review_fixes_support::{live_workspace, parse_workspace};

#[test]
fn older_paid_invoice_is_not_suppressed_by_newer_subscription_delivery() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Payment ordering", "evt_paymentstart");
    app.stripe.set_payment_failed();
    app.runtime.advance(1);
    accept(
        &app,
        "evt_paymentfailed",
        "invoice.payment_failed",
        json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
        DeliveryStatus::Done,
    );

    app.runtime.advance(1);
    let paid_at = app.runtime.now().timestamp();
    app.stripe.set_payment_paid();
    app.runtime.advance(1);
    accept(
        &app,
        "evt_subscriptionafterpaid",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    let paid = app.event_body_at(
        "evt_olderpaid",
        "invoice.paid",
        paid_at,
        json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
    );
    app.body(app.webhook(paid, app.runtime.now().timestamp(), true), 202);
    app.wait_delivery("evt_olderpaid", DeliveryStatus::Done);

    assert_payment_current(&app, &workspace);
}

#[test]
fn equal_second_invoice_events_follow_canonical_provider_state() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Payment tie", "evt_paymenttiestart");
    app.stripe.set_payment_paid();
    app.runtime.advance(1);
    let created = app.runtime.now().timestamp();
    for (id, event) in [
        ("evt_samepaid", "invoice.paid"),
        ("evt_samefailed", "invoice.payment_failed"),
    ] {
        let body = app.event_body_at(
            id,
            event,
            created,
            json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
        );
        app.body(app.webhook(body, created, true), 202);
        app.wait_delivery(id, DeliveryStatus::Done);
    }

    assert_payment_current(&app, &workspace);
}

#[test]
fn replacement_subscription_does_not_inherit_previous_payment_failure() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Payment replacement", "evt_replacestart");
    app.stripe.set_payment_failed();
    app.runtime.advance(1);
    accept(
        &app,
        "evt_replacefailed",
        "invoice.payment_failed",
        json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
        DeliveryStatus::Done,
    );

    app.stripe.set_subscription("canceled", false);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_replacecanceled",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.stripe.set_payment_paid();
    app.stripe.set_subscription("active", false);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_replacement",
        "customer.subscription.created",
        json!({"id":"sub_replacement","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );

    app.queries(&mut |queries| {
        let subscription = queries
            .billing_subscription(parse_workspace(&workspace))
            .unwrap()
            .unwrap();
        assert_eq!(subscription.provider_subscription_id, "sub_replacement");
        assert!(subscription.payment_failed_at.is_none());
        assert!(subscription.payment_updated_at.is_none());
    });
    app.assert_no_server_errors();
}

fn assert_payment_current(app: &Harness, workspace: &str) {
    app.queries(&mut |queries| {
        assert!(
            queries
                .billing_subscription(parse_workspace(workspace))
                .unwrap()
                .unwrap()
                .payment_failed_at
                .is_none()
        );
    });
    app.assert_no_server_errors();
}
