//! Multiple verified accounts, candidate refreshes and cross-workspace conflicts.

use mkc_domain::ids::OrganizationId;
use mkc_store_interface::integration::IntegrationSubject;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::harness;
use super::harness::Harness;
use super::installation_workflow::{connect, finish, list, start};

#[test]
fn two_accounts_bind_to_one_workspace_and_a_candidate_refreshes_the_same_rows() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    app.github.mode.lock().unwrap().second_installation = true;
    let workspace = app.workspace("Multiple accounts");
    connect(&mut app, &workspace, 1, false);
    connect(&mut app, &workspace, 2, false);
    let rows = list(&app, &workspace);
    assert_eq!(rows["items"].as_array().unwrap().len(), 2);
    assert_eq!(rows["items"][0]["account"], "octocat");
    assert_eq!(rows["items"][0]["accountKind"], "user");
    assert_eq!(rows["items"][1]["account"], "fixture-org");
    assert_eq!(rows["items"][1]["accountKind"], "organization");
    for row in rows["items"].as_array().unwrap() {
        assert_eq!(row["workspaceId"], workspace["id"]);
        assert_eq!(row["state"], "connected");
    }
    let id = rows["items"][1]["id"].as_str().unwrap();
    let repository_path = format!("/v1/github/installations/{id}/repositories");
    let before = harness::json(
        app.request(Method::GET, &repository_path).send().unwrap(),
        200,
    );
    assert_eq!(before["items"][0]["fullName"], "fixture-org/Catalogue");
    app.github.mode.lock().unwrap().second_repository_name = Some("fixture-org/Renamed".into());
    connect(&mut app, &workspace, 2, true);
    let refreshed = list(&app, &workspace);
    assert_eq!(refreshed["items"][1]["id"], rows["items"][1]["id"]);
    let after = harness::json(
        app.request(Method::GET, &repository_path).send().unwrap(),
        200,
    );
    assert_eq!(after["items"][0]["id"], before["items"][0]["id"]);
    assert_eq!(after["items"][0]["fullName"], "fixture-org/Renamed");
    let workspace_id: OrganizationId = workspace["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into();
    app.queries(&mut |queries| {
        assert!(
            queries
                .integration(IntegrationSubject::Organization(workspace_id))
                .unwrap()
                .is_none()
        );
        assert!(
            queries
                .integration(IntegrationSubject::User(app.user))
                .unwrap()
                .is_some()
        );
    });
}

#[test]
fn another_workspace_cannot_take_a_bound_installation_with_either_flow_start() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let workspace = app.workspace("Original workspace");
    let other = app.workspace("Other installation workspace");
    connect(&mut app, &workspace, 1, false);
    for candidate in [false, true] {
        let flow = start(&app, &other, 1, candidate);
        let refused = finish(&mut app, &flow, 409);
        assert_eq!(refused["error"]["reason"], "github-installation-conflict");
        assert_eq!(list(&app, &workspace)["items"].as_array().unwrap().len(), 1);
        assert!(list(&app, &other)["items"].as_array().unwrap().is_empty());
    }
    let stateless = harness::json(
        app.request(Method::POST, "/v1/github/installations/callback")
            .json(&json!({"installationId":1}))
            .send()
            .unwrap(),
        400,
    );
    assert_eq!(stateless["error"]["reason"], "validation-failed");
    assert_eq!(list(&app, &workspace)["items"].as_array().unwrap().len(), 1);
}

#[test]
fn installation_filter_requires_membership_and_includes_suspended_bindings() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    app.github.mode.lock().unwrap().second_installation = true;
    let workspace = app.workspace("Installation filter");
    let empty = app.workspace("Empty installation workspace");
    connect(&mut app, &workspace, 1, false);
    connect(&mut app, &workspace, 2, false);
    let workspace_id: OrganizationId = workspace["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into();
    app.queries(&mut |queries| {
        let mut bindings = queries.github_installations(workspace_id).unwrap();
        bindings[0].active = false;
        queries.save_github_installation(&bindings[0]).unwrap();
    });
    let rows = list(&app, &workspace);
    assert_eq!(rows["items"][0]["state"], "suspended");
    assert_eq!(rows["items"][1]["state"], "connected");
    let read = harness::json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace_id}"))
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(read["githubInstallationState"], "connected");
    let selected = rows["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["state"] == "connected")
        .unwrap();
    assert_eq!(selected["account"], "fixture-org");
    assert_eq!(
        selected["manageUrl"],
        "https://github.com/organizations/fixture-org/settings/installations/2"
    );
    let repositories = harness::json(
        app.request(
            Method::GET,
            &format!(
                "/v1/github/installations/{}/repositories",
                selected["id"].as_str().unwrap()
            ),
        )
        .send()
        .unwrap(),
        200,
    );
    assert_eq!(
        repositories["items"][0]["fullName"],
        "fixture-org/Catalogue"
    );
    assert!(list(&app, &empty)["items"].as_array().unwrap().is_empty());
    app.queries(&mut |queries| {
        for member in queries.members(workspace_id).unwrap() {
            queries.delete_member(member.id).unwrap();
        }
    });
    for id in [workspace_id.to_string(), Uuid::now_v7().to_string()] {
        let denied = harness::json(
            app.request(
                Method::GET,
                &format!("/v1/github/installations?workspaceId={id}"),
            )
            .send()
            .unwrap(),
            404,
        );
        assert_eq!(denied["error"]["reason"], "not-found");
    }
    let unfiltered = harness::json(
        app.request(Method::GET, "/v1/github/installations")
            .send()
            .unwrap(),
        200,
    );
    assert!(unfiltered["items"].as_array().unwrap().is_empty());
}
