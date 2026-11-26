//! Which reader of the billing read is offered the way to manage billing.

use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;

use super::harness::Harness;
use super::lifecycle_support::accept;
use super::review_fixes_support::live_workspace;

/// An admin reads the same facts of a paid workspace as its owner, a failed
/// payment included, but only an owner manages billing, so the read tells the
/// admin's pane to name an owner instead of drawing the owner's controls.
#[test]
fn an_admin_reads_billing_without_the_way_to_manage_it() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = live_workspace(&app, "Admin billing read", "evt_admincreated1");
    let invitation = app.json(
        app.request(Method::POST, &format!("/v1/workspaces/{workspace}/members"))
            .json(&json!({"email":&app.reviewer.email,"role":"admin"}))
            .send()
            .unwrap(),
        201,
    );
    let accept_path = format!(
        "/v1/workspaces/{workspace}/invitations/{}/accept",
        invitation["id"].as_str().unwrap()
    );
    app.json(
        app.request_as(Method::POST, &accept_path, &app.reviewer)
            .send()
            .unwrap(),
        200,
    );
    app.runtime.advance(1);
    app.stripe.set_payment_failed();
    accept(
        &app,
        "evt_adminfailed1",
        "invoice.payment_failed",
        json!({"customer":"cus_fixture","subscription":"sub_fixture"}),
        DeliveryStatus::Done,
    );

    let billing_path = format!("/v1/workspaces/{workspace}/billing");
    let mut admin_read = app.json(
        app.request_as(Method::GET, &billing_path, &app.reviewer)
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(admin_read["manageable"], false);
    assert_eq!(admin_read["plan"], "team");
    assert!(
        admin_read["subscription"]["paymentFailedAt"].is_string(),
        "{admin_read}"
    );
    // Both people hold an Editor seat, which the admin reads like the owner.
    assert_eq!(
        admin_read["seats"][0],
        json!({"kind":"editor","inUse":2,"unitAmountCents":2000})
    );
    let mut owner_read = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(owner_read["manageable"], true);
    // Apart from the way to manage it, the admin reads every fact the owner reads.
    admin_read["manageable"] = json!(null);
    owner_read["manageable"] = json!(null);
    assert_eq!(admin_read, owner_read);
}
