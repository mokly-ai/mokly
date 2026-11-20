//! Bound installation metadata follows workspace access for every role.

use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_domain::values::Role;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;

use super::harness::{Harness, json as response_json};

fn role(app: &Harness, workspace: OrganizationId, role: Role) {
    app.queries(&mut |queries| {
        let mut member = queries
            .members(workspace)
            .unwrap()
            .into_iter()
            .find(|member| member.user_id == Some(app.user))
            .unwrap();
        member.role = role;
        queries.save_member(&member).unwrap();
    });
}

fn read_binding(app: &Harness, workspace: OrganizationId, state: &str) {
    let path = format!("/v1/workspaces/{workspace}");
    let body = response_json(app.request(Method::GET, &path).send().unwrap(), 200);
    assert_eq!(body["plan"], "free");
    assert_eq!(body["githubInstallationState"], state);
    assert!(body.get("githubAccount").is_none());
    assert!(body.get("githubManageUrl").is_none());
    let list = response_json(
        app.request(Method::GET, "/v1/workspaces").send().unwrap(),
        200,
    );
    let listed = list["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["id"] == workspace.to_string())
        .unwrap();
    assert_eq!(listed["plan"], "free");
    assert_eq!(
        listed["githubInstallationState"],
        body["githubInstallationState"]
    );
    assert!(listed.get("githubAccount").is_none());
    assert!(listed.get("githubManageUrl").is_none());
    let installations = response_json(
        app.request(
            Method::GET,
            &format!("/v1/github/installations?workspaceId={workspace}"),
        )
        .send()
        .unwrap(),
        200,
    );
    let rows = installations["items"].as_array().unwrap();
    if state == "absent" {
        assert!(rows.is_empty());
    } else {
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["account"], "octocat");
        assert_eq!(rows[0]["state"], state);
        assert_eq!(
            rows[0]["manageUrl"],
            "https://github.com/settings/installations/1"
        );
    }
}

#[test]
fn bound_installation_reads_cover_roles_suspension_disconnect_and_guests() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let mut workspace = None;
    app.queries(&mut |queries| {
        workspace = Some(
            queries
                .project(project.id)
                .unwrap()
                .unwrap()
                .organization_id,
        );
    });
    let workspace = workspace.unwrap();
    for suspended in [false, true] {
        if suspended {
            app.github.mode.lock().unwrap().suspended = true;
            app.send("installation", "suspend", DeliveryStatus::Done);
        }
        for member_role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            role(&app, workspace, member_role);
            read_binding(
                &app,
                workspace,
                if suspended { "suspended" } else { "connected" },
            );
            let installations = response_json(
                app.request(Method::GET, "/v1/github/installations")
                    .send()
                    .unwrap(),
                200,
            );
            assert_eq!(installations["items"].as_array().unwrap().len(), 1);
        }
    }
    let mut member = None;
    app.queries(&mut |queries| {
        member = queries
            .members(workspace)
            .unwrap()
            .into_iter()
            .find(|member| member.user_id == Some(app.user));
        queries.delete_member(member.as_ref().unwrap().id).unwrap();
    });
    for direct_role in [Role::Admin, Role::Member, Role::Reviewer] {
        app.queries(&mut |queries| {
            let mut grant = queries
                .grants(project.id)
                .unwrap()
                .into_iter()
                .find(|grant| grant.user_id == app.user)
                .unwrap();
            grant.role = direct_role;
            queries.save_grant(&grant).unwrap();
        });
        assert_guest(&app, workspace, project.id);
    }
    let cookie = app.cookie.clone();
    app.cookie.clear();
    for path in [
        "/v1/workspaces".to_owned(),
        format!("/v1/workspaces/{workspace}"),
    ] {
        let denied = response_json(app.request(Method::GET, &path).send().unwrap(), 401);
        assert_eq!(denied["error"]["reason"], "unauthenticated");
    }
    app.cookie = cookie;
    app.queries(&mut |queries| {
        let mut member = member.clone().unwrap();
        member.role = Role::Owner;
        queries.insert_member(&member).unwrap();
    });
    assert_eq!(
        app.request(
            Method::DELETE,
            &format!("/v1/github/installations/{}", project.installation)
        )
        .send()
        .unwrap()
        .status(),
        204
    );
    read_binding(&app, workspace, "absent");
    app.queries(&mut |queries| {
        let installation = queries
            .github_installation(project.installation)
            .unwrap()
            .unwrap();
        assert!(!installation.connected);
        assert!(installation.organization_id.is_none());
    });
}

fn assert_guest(app: &Harness, workspace: OrganizationId, project: ProjectId) {
    assert_eq!(
        app.request(Method::GET, &format!("/v1/projects/{project}"))
            .send()
            .unwrap()
            .status(),
        200
    );
    let denied = response_json(
        app.request(Method::GET, &format!("/v1/workspaces/{workspace}"))
            .send()
            .unwrap(),
        404,
    );
    assert_eq!(denied["error"]["reason"], "not-found");
    let list = response_json(
        app.request(Method::GET, "/v1/workspaces").send().unwrap(),
        200,
    );
    assert!(
        list["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item["id"] != workspace.to_string())
    );
}
