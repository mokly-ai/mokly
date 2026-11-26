//! Which reader of the billing read is offered the way to manage billing.

use reqwest::Method;
use serde_json::json;

use super::harness::Harness;
use super::review_fixes_support::create_workspace;

/// An admin reads the workspace's billing, but only an owner manages it, so
/// the read tells the admin's pane to name an owner instead of drawing the
/// owner's controls.
#[test]
fn an_admin_reads_billing_without_the_way_to_manage_it() {
    let Some(app) = Harness::start() else {
        return;
    };
    let workspace = create_workspace(&app, "Admin billing read");
    let invitation = app.json(
        app.request(Method::POST, &format!("/v1/workspaces/{workspace}/members"))
            .json(&json!({"email":&app.reviewer.email,"role":"admin"}))
            .send()
            .unwrap(),
        201,
    );
    let accept = format!(
        "/v1/workspaces/{workspace}/invitations/{}/accept",
        invitation["id"].as_str().unwrap()
    );
    app.json(
        app.request_as(Method::POST, &accept, &app.reviewer)
            .send()
            .unwrap(),
        200,
    );

    let billing_path = format!("/v1/workspaces/{workspace}/billing");
    let admin_read = app.json(
        app.request_as(Method::GET, &billing_path, &app.reviewer)
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(admin_read["manageable"], false);
    // Both people hold an Editor seat, which the admin reads like the owner.
    assert_eq!(
        admin_read["seats"][0],
        json!({"kind":"editor","inUse":2,"unitAmountCents":2000})
    );
    let owner_read = app.json(app.request(Method::GET, &billing_path).send().unwrap(), 200);
    assert_eq!(owner_read["manageable"], true);
}
