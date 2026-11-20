//! Reusable API steps and exact Stripe request assertions for the lifecycle smoke.

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::{OrganizationId, RepositoryId};
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::installed::seed_installed_repository;

use super::harness::{APP, Harness};
use super::stripe_double::{COLLABORATOR_PRICE, Call, EDITOR_PRICE};

pub(super) fn accept(app: &Harness, id: &str, event: &str, object: Value, status: DeliveryStatus) {
    app.accept_event(id, event, object);
    app.wait_delivery(id, status);
}

pub(super) fn invite_reviewer(app: &Harness, workspace: &str) -> String {
    let invitation = app.json(
        app.request(Method::POST, &format!("/v1/workspaces/{workspace}/members"))
            .json(&json!({"email":&app.reviewer.email,"role":"reviewer"}))
            .send()
            .unwrap(),
        201,
    );
    let path = format!(
        "/v1/workspaces/{workspace}/invitations/{}/accept",
        invitation["id"].as_str().unwrap()
    );
    app.json(
        app.request_as(Method::POST, &path, &app.reviewer)
            .send()
            .unwrap(),
        200,
    );
    invitation["id"].as_str().unwrap().to_owned()
}

pub(super) fn assert_checkout_contract(app: &Harness, workspace: &str, slug: &str) {
    let calls = app.stripe.calls();
    let customer = calls
        .iter()
        .find(|call| call.path == "/v1/customers")
        .unwrap();
    let customer_key = format!("customer:{workspace}");
    assert_eq!(
        customer.idempotency_key.as_deref(),
        Some(customer_key.as_str())
    );
    assert_eq!(field(customer, "name"), Some("Billing lifecycle"));
    assert_eq!(field(customer, "email"), Some("owner@example.com"));
    assert_eq!(
        field(customer, "metadata[organization_id]"),
        Some(workspace)
    );
    let checkout = calls
        .iter()
        .find(|call| call.path == "/v1/checkout/sessions")
        .unwrap();
    let checkout_id = field(checkout, "metadata[checkout_session_id]").unwrap();
    assert_eq!(
        checkout.idempotency_key.as_deref(),
        Some(format!("checkout:{checkout_id}").as_str())
    );
    assert_eq!(
        field(checkout, "subscription_data[metadata][checkout_session_id]"),
        Some(checkout_id)
    );
    let session_end = (app.runtime.now().timestamp() + 60 * 60).to_string();
    assert_eq!(field(checkout, "expires_at"), Some(session_end.as_str()));
    assert_eq!(field(checkout, "line_items[0][price]"), Some(EDITOR_PRICE));
    assert_eq!(field(checkout, "line_items[0][quantity]"), Some("1"));
    assert_eq!(field(checkout, "line_items[1][price]"), None);
    assert_eq!(
        field(checkout, "subscription_data[trial_period_days]"),
        Some("7")
    );
    assert_eq!(field(checkout, "automatic_tax[enabled]"), Some("true"));
    assert_eq!(
        field(checkout, "billing_address_collection"),
        Some("required")
    );
    assert_eq!(field(checkout, "customer_update[address]"), Some("auto"));
    let success = format!("{APP}/{slug}/-/settings/billing?checkout=success");
    let cancel = format!("{APP}/{slug}/-/settings/billing?checkout=cancelled");
    assert_eq!(field(checkout, "success_url"), Some(success.as_str()));
    assert_eq!(field(checkout, "cancel_url"), Some(cancel.as_str()));
    let portal = calls
        .iter()
        .find(|call| call.path == "/v1/billing_portal/sessions")
        .unwrap();
    let portal_return = format!("{APP}/{slug}/-/settings/billing");
    assert_eq!(field(portal, "return_url"), Some(portal_return.as_str()));
    assert!(
        portal
            .idempotency_key
            .as_deref()
            .unwrap()
            .starts_with(&format!("portal:{workspace}:"))
    );
}

pub(super) fn assert_collaborator_request(app: &Harness, workspace: &str) {
    let calls = app.stripe.calls();
    let call = calls
        .iter()
        .find(|call| {
            call.path == "/v1/subscription_items"
                && field(call, "price") == Some(COLLABORATOR_PRICE)
        })
        .unwrap();
    assert_eq!(field(call, "quantity"), Some("1"));
    assert!(
        call.idempotency_key
            .as_deref()
            .unwrap()
            .starts_with(&format!("seats:{workspace}:collaborator:"))
    );
}

pub(super) fn assert_seat_change_requests(app: &Harness, workspace: &str) {
    let calls = app.stripe.calls();
    let editor = calls
        .iter()
        .find(|call| {
            call.method == "POST"
                && call.path == "/v1/subscription_items/si_editor_fixture"
                && field(call, "quantity") == Some("2")
        })
        .unwrap();
    assert!(
        editor
            .idempotency_key
            .as_deref()
            .unwrap()
            .starts_with(&format!("seats:{workspace}:editor:"))
    );
    let collaborator = calls
        .iter()
        .find(|call| {
            call.method == "DELETE" && call.path == "/v1/subscription_items/si_collaborator_fixture"
        })
        .unwrap();
    assert_eq!(collaborator.idempotency_key, None);
}

pub(super) fn assert_free_private_transition_is_refused(app: &Harness, workspace: &str) {
    let workspace_id: OrganizationId = workspace.parse::<Uuid>().unwrap().into();
    let mut repository = None;
    app.queries(&mut |queries| {
        repository = Some(seed_installed_repository(
            queries,
            workspace_id,
            "mokly/free",
        ));
    });
    let repository: RepositoryId = repository.unwrap();
    let project = app.json(
        app.request(
            Method::POST,
            &format!("/v1/workspaces/{workspace}/projects"),
        )
        .json(&json!({
            "name":"Free project",
            "slug":"free-project",
            "repositoryId":repository.0,
            "configPath":"mokly.config.json"
        }))
        .send()
        .unwrap(),
        201,
    );
    assert_eq!(project["visibility"], "public");
    let refused = app.json(
        app.request(
            Method::PATCH,
            &format!("/v1/projects/{}", project["id"].as_str().unwrap()),
        )
        .json(&json!({
            "name":"Free project",
            "slug":"free-project",
            "visibility":"private",
            "requireApproval":false,
            "version":1
        }))
        .send()
        .unwrap(),
        400,
    );
    assert_eq!(refused["error"]["reason"], "plan-required");
}

pub(super) fn assert_cancel_contract(app: &Harness) {
    let calls = app.stripe.calls();
    let cancel = calls
        .iter()
        .find(|call| call.method == "DELETE" && call.path == "/v1/subscriptions/sub_fixture")
        .unwrap();
    assert_eq!(
        cancel.idempotency_key.as_deref(),
        Some("cancel:sub_fixture")
    );
}

fn field<'a>(call: &'a Call, name: &str) -> Option<&'a str> {
    call.form
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}
