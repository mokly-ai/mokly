//! Shared setup and assertions for billing review regressions.

use chrono::{DateTime, Duration, Utc};

use mkc_domain::ids::OrganizationId;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::harness::Harness;
use super::lifecycle_support::accept;
use super::stripe_double::{Call, EDITOR_PRICE};

pub(super) fn live_workspace(app: &Harness, name: &str, event: &str) -> String {
    let workspace = create_workspace(app, name);
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
    app.runtime.advance(1);
    accept(
        app,
        event,
        "customer.subscription.created",
        json!({"id":"sub_fixture","customer":"cus_fixture"}),
        DeliveryStatus::Done,
    );
    workspace
}

pub(super) fn create_workspace(app: &Harness, name: &str) -> String {
    let slug = name.to_ascii_lowercase().replace(' ', "-");
    app.json(
        app.request(Method::POST, "/v1/workspaces")
            .json(&json!({"name":name,"slug":slug}))
            .send()
            .unwrap(),
        201,
    )["id"]
        .as_str()
        .unwrap()
        .to_owned()
}

pub(super) fn invite_editor(app: &Harness, workspace: &str) -> String {
    let invitation = app.json(
        app.request(Method::POST, &format!("/v1/workspaces/{workspace}/members"))
            .json(&json!({"email":&app.reviewer.email,"role":"member"}))
            .send()
            .unwrap(),
        201,
    );
    let id = invitation["id"].as_str().unwrap();
    app.json(
        app.request_as(
            Method::POST,
            &format!("/v1/workspaces/{workspace}/invitations/{id}/accept"),
            &app.reviewer,
        )
        .send()
        .unwrap(),
        200,
    );
    id.to_owned()
}

pub(super) fn editor_quantity(app: &Harness) -> i64 {
    app.stripe.subscription_object()["items"]["data"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["price"]["id"] == EDITOR_PRICE)
        .unwrap()["quantity"]
        .as_i64()
        .unwrap()
}

pub(super) fn editor_update_keys(app: &Harness) -> Vec<String> {
    app.stripe
        .calls()
        .into_iter()
        .filter(|call| {
            call.path == "/v1/subscription_items/si_editor_fixture" && call.method == "POST"
        })
        .map(|call| call.idempotency_key.unwrap())
        .collect()
}

pub(super) fn parse_workspace(value: &str) -> OrganizationId {
    OrganizationId(Uuid::parse_str(value).unwrap())
}

pub(super) fn field<'a>(call: &'a Call, name: &str) -> Option<&'a str> {
    call.form
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}

pub(super) fn checkout_calls(app: &Harness) -> Vec<Call> {
    app.stripe
        .calls()
        .into_iter()
        .filter(|call| call.path == "/v1/checkout/sessions")
        .collect()
}

pub(super) fn assert_checkout_lifetime(call: &Call, requested_at: DateTime<Utc>) {
    let expires_at = expires_at_field(call);
    assert_eq!(
        expires_at - requested_at.timestamp(),
        Duration::hours(1).num_seconds()
    );
}

pub(super) fn expires_at_field(call: &Call) -> i64 {
    field(call, "expires_at").unwrap().parse::<i64>().unwrap()
}

pub(super) fn session_id(response: &serde_json::Value) -> &str {
    response["url"]
        .as_str()
        .unwrap()
        .rsplit('/')
        .next()
        .unwrap()
}
