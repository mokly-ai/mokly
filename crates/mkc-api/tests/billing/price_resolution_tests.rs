//! Lookup-key startup resolution and historical-price reconciliation regressions.

use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;

use super::harness::Harness;
use super::review_fixes_support::{create_workspace, live_workspace, parse_workspace};
use super::stripe_double::PriceScenario;

#[test]
fn missing_lookup_key_leaves_checkout_unavailable() {
    let Some(app) = Harness::start_with_price_scenario(PriceScenario::MissingEditor) else {
        return;
    };
    let workspace = create_workspace(&app, "Missing catalogue price");
    let billing = app.json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace}/billing"))
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(billing["checkoutAvailable"], false);
}

#[test]
fn mismatched_resolved_amount_leaves_checkout_unavailable() {
    let Some(app) = Harness::start_with_price_scenario(PriceScenario::WrongEditorAmount) else {
        return;
    };
    let workspace = create_workspace(&app, "Wrong catalogue amount");
    let billing = app.json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace}/billing"))
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(billing["checkoutAvailable"], false);
}

#[test]
fn replaced_price_reconciles_through_the_stored_provider_item_kind() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Historical subscription price", "evt_initial");
    app.stripe
        .replace_subscription_item_price("si_editor_fixture", "price_replaced_fixture");
    app.runtime.advance(1);
    app.accept_event(
        "evt_replacedprice",
        "customer.subscription.updated",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
    );
    let delivery = app.wait_delivery_terminal("evt_replacedprice");
    assert_eq!(delivery.status, DeliveryStatus::Done);
    app.queries(&mut |queries| {
        let items = queries
            .billing_subscription_items(parse_workspace(&workspace))
            .unwrap();
        let editor = items
            .iter()
            .find(|item| item.provider_item_id == "si_editor_fixture")
            .unwrap();
        assert_eq!(editor.seat_kind, SeatKind::Editor);
        assert_eq!(editor.price_id, "price_replaced_fixture");
    });
}

#[test]
fn delayed_first_webhook_maps_historical_prices_by_seat_metadata() {
    let Some(app) = Harness::start_with_price_scenario(PriceScenario::Replaced) else {
        return;
    };
    let workspace = create_workspace(&app, "Delayed historical subscription");
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
    app.stripe.seed_historical_checkout(&workspace);
    app.accept_event(
        "evt_delayedhistorical",
        "customer.subscription.created",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
    );
    let delivery = app.wait_delivery_terminal("evt_delayedhistorical");
    assert_eq!(delivery.status, DeliveryStatus::Done);
    app.queries(&mut |queries| {
        let workspace_id = parse_workspace(&workspace);
        assert_eq!(
            queries.organization(workspace_id).unwrap().unwrap().plan,
            Plan::Team
        );
        let items = queries.billing_subscription_items(workspace_id).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| {
            item.provider_item_id == "si_editor_fixture" && item.seat_kind == SeatKind::Editor
        }));
        assert!(items.iter().any(|item| {
            item.provider_item_id == "si_collaborator_fixture"
                && item.seat_kind == SeatKind::Collaborator
        }));
    });
}
