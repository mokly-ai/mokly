//! Checkout attribution and leased seat-command recovery regressions.

use std::thread;

use chrono::Duration;
use mkc_billing::seats::worker::SeatReconciler;
use mkc_domain::values::SeatKind;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;

use super::harness::Harness;
use super::lifecycle_support::{accept, invite_reviewer};
use super::review_fixes_support::{
    create_workspace, editor_quantity, editor_update_keys, invite_editor, live_workspace,
    parse_workspace,
};

#[test]
fn checkout_trial_is_consumed_when_first_bound_as_active() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = create_workspace(&app, "Delayed active trial");
    app.json(
        app.request(
            Method::POST,
            &format!("/v1/workspaces/{workspace}/billing/checkout"),
        )
        .json(&json!({}))
        .send()
        .unwrap(),
        201,
    );
    app.stripe.set_subscription("active", false);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_activetrial",
        "customer.subscription.created",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.queries(&mut |queries| {
        let workspace = parse_workspace(&workspace);
        assert!(
            queries
                .billing_customer(workspace)
                .unwrap()
                .unwrap()
                .trial_used_at
                .is_some()
        );
        assert!(
            queries
                .billing_checkout_session(workspace)
                .unwrap()
                .is_none()
        );
    });
}

#[test]
fn lost_seat_response_reuses_one_command_until_webhook_confirmation() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Seat response recovery", "evt_seatlossstart");
    invite_editor(&app, &workspace);
    app.stripe.lose_next_seat_response();
    assert!(app.run_seats());
    assert_eq!(editor_quantity(&app), 2);
    let first_key = editor_update_keys(&app)[0].clone();

    app.runtime.advance(Duration::hours(1).num_seconds());
    assert!(app.run_seats());
    let keys = editor_update_keys(&app);
    assert_eq!(keys, vec![first_key.clone(), first_key]);
    app.runtime.advance(1);
    accept(
        &app,
        "evt_seatlossconfirmed",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.queries(&mut |queries| {
        assert!(
            queries
                .billing_seat_command(parse_workspace(&workspace), SeatKind::Editor,)
                .unwrap()
                .is_none()
        );
    });
}

#[test]
fn concurrent_seat_workers_make_one_provider_write() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Concurrent seats", "evt_concurrentstart");
    invite_editor(&app, &workspace);
    let first = app.seat_reconciler();
    let second = app.seat_reconciler();
    thread::scope(|scope| {
        let first = scope.spawn(move || first.run_once().unwrap());
        let second = scope.spawn(move || second.run_once().unwrap());
        assert!(first.join().unwrap());
        assert!(second.join().unwrap());
    });
    assert_eq!(editor_quantity(&app), 2);
    assert_eq!(editor_update_keys(&app).len(), 1);
}

#[test]
fn lost_delete_response_recovers_from_provider_not_found_without_a_key() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Seat delete recovery", "evt_deletestart");
    let reviewer = invite_reviewer(&app, &workspace);
    assert!(app.run_seats());
    app.runtime.advance(1);
    accept(
        &app,
        "evt_collaboratoradded",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    app.json(
        app.request(
            Method::PATCH,
            &format!("/v1/workspaces/{workspace}/members/{reviewer}"),
        )
        .json(&json!({"role":"member","version":2}))
        .send()
        .unwrap(),
        200,
    );
    app.stripe.lose_next_delete_response();
    assert!(app.run_seats());
    app.runtime.advance(Duration::hours(1).num_seconds());
    assert!(app.run_seats());
    let deletes: Vec<_> = app
        .stripe
        .calls()
        .into_iter()
        .filter(|call| {
            call.method == "DELETE" && call.path == "/v1/subscription_items/si_collaborator_fixture"
        })
        .collect();
    assert_eq!(deletes.len(), 2);
    assert!(deletes.iter().all(|call| call.idempotency_key.is_none()));
    app.runtime.advance(1);
    accept(
        &app,
        "evt_collaboratordeleted",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
}
