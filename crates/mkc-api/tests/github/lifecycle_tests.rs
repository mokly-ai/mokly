//! Workspace deletion preserves projects left by an earlier disconnection.

use mkc_domain::ids::OrganizationId;
use mkc_domain::values::Role;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::harness::{Harness, json as response_json};

#[test]
fn deleting_a_reconnected_workspace_keeps_the_prior_workspaces_project() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let other = app.workspace("Reconnected workspace");
    let id: OrganizationId = other["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into();
    app.queries(&mut |queries| {
        let mut installation = queries.github_installation(project.installation)?.unwrap();
        installation.organization_id = Some(id);
        queries.save_github_installation(&installation)?;
        Ok(())
    });
    let response = app
        .request(Method::DELETE, &format!("/v1/workspaces/{id}"))
        .json(&json!({"version":1,"confirmationName":"Reconnected workspace"}))
        .send()
        .unwrap();
    assert_eq!(response.status(), 204, "{}", response.text().unwrap());
    app.queries(&mut |queries| {
        assert!(queries.organization(id)?.is_none());
        assert!(queries.project(project.id)?.is_some());
        let installation = queries.github_installation(project.installation)?.unwrap();
        assert!(installation.organization_id.is_none());
        assert!(!installation.connected);
        Ok(())
    });
}

#[test]
fn suspended_installation_stays_visible_and_allows_another_installation_start() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let mut workspace = None;
    app.queries(&mut |queries| {
        workspace = queries
            .github_installation(project.installation)?
            .unwrap()
            .organization_id;
        Ok(())
    });
    let workspace = workspace.unwrap();
    app.github.mode.lock().unwrap().suspended = true;
    app.send("installation", "suspend", DeliveryStatus::Done);
    let bound = response_json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace}"))
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(bound["githubInstallationState"], "suspended");
    let list = response_json(
        app.request(Method::GET, "/v1/github/installations")
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
    assert_eq!(list["items"][0]["state"], "suspended");
    assert_eq!(list["items"][0]["account"], "octocat");
    assert_eq!(
        list["items"][0]["manageUrl"],
        "https://github.com/settings/installations/1"
    );
    assert_eq!(
        app.request(
            Method::GET,
            &format!(
                "/v1/github/installations/{}/repositories",
                project.installation
            )
        )
        .send()
        .unwrap()
        .status(),
        404
    );
    let start = response_json(
        app.request(Method::POST, "/v1/github/installations")
            .json(&json!({"workspaceId":workspace.to_string()}))
            .send()
            .unwrap(),
        200,
    );
    assert!(
        start["authorizeUrl"]
            .as_str()
            .unwrap()
            .contains("/installations/new?")
    );
    app.queries(&mut |queries| {
        let mut member = queries
            .members(workspace)?
            .into_iter()
            .find(|member| member.user_id == Some(app.user))
            .unwrap();
        member.role = Role::Member;
        queries.save_member(&member)?;
        Ok(())
    });
    let denied = response_json(
        app.request(Method::POST, "/v1/github/installations")
            .json(&json!({"workspaceId":workspace.to_string()}))
            .send()
            .unwrap(),
        403,
    );
    assert_eq!(denied["error"]["reason"], "permission-denied");
    app.queries(&mut |queries| {
        let mut member = queries
            .members(workspace)?
            .into_iter()
            .find(|member| member.user_id == Some(app.user))
            .unwrap();
        member.role = Role::Owner;
        queries.save_member(&member)?;
        Ok(())
    });
    app.github.mode.lock().unwrap().suspended = false;
    app.send("installation", "installation", DeliveryStatus::Done);
    response_json(
        app.request(Method::POST, "/v1/github/installations")
            .json(&json!({"workspaceId":workspace.to_string()}))
            .send()
            .unwrap(),
        200,
    );
}
