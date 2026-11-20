//! CLI project identities, shared duplicates, plan gates and cloud-build refusals.

use mkc_domain::ids::ProjectId;
use mkc_domain::values::Plan;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use super::build_provider::RunMode;
use super::check_support::wait_until;
use super::harness;
use super::harness::Harness;
use super::installation_workflow::{connect, list};

fn create(app: &Harness, workspace: &Value, repository: &str, slug: &str) -> Value {
    harness::json(app.request(Method::POST, &format!("/v1/workspaces/{}/projects", workspace["id"].as_str().unwrap()))
        .json(&json!({"name":"CLI catalogue","slug":slug,"repository":repository,"configPath":"mokly.config.json"})).send().unwrap(), 201)
}

#[test]
fn cli_projects_publish_from_another_host_and_keep_cloud_builds_off() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    for (plan, visibility) in [(Plan::Free, "public"), (Plan::Team, "private")] {
        let workspace = app.workspace(&format!("CLI {plan:?}"));
        let workspace_id = workspace["id"]
            .as_str()
            .unwrap()
            .parse::<Uuid>()
            .unwrap()
            .into();
        app.queries(&mut |queries| {
            let mut workspace = queries.organization(workspace_id).unwrap().unwrap();
            workspace.plan = plan;
            queries.save_organization(&workspace).unwrap();
        });
        let created = create(
            &app,
            &workspace,
            "gitlab.com/Team/Subgroup/Catalogue.git",
            "catalogue",
        );
        assert_eq!(created["repository"], "gitlab.com/team/subgroup/catalogue");
        assert_eq!(created["visibility"], visibility);
        for field in ["automaticBuilds", "buildsAvailable", "canRequestBuilds"] {
            assert_eq!(created[field], false);
        }
        let project: ProjectId = created["id"]
            .as_str()
            .unwrap()
            .parse::<Uuid>()
            .unwrap()
            .into();
        app.queries(&mut |queries| {
            assert!(
                queries
                    .github_project_repository(project)
                    .unwrap()
                    .is_none()
            );
        });
        let path = format!("/v1/projects/{project}");
        let refused = harness::json(
            app.request(Method::PATCH, &path)
                .json(&json!({
                    "name":created["name"],"slug":created["slug"],"visibility":visibility,
                    "requireApproval":false,"version":1,"automaticBuilds":true,
                }))
                .send()
                .unwrap(),
            400,
        );
        assert_eq!(refused["error"]["reason"], "builds-unavailable");
        let refused = harness::json(
            app.request(Method::POST, &format!("{path}/builds"))
                .json(&json!({"branch":"main"}))
                .send()
                .unwrap(),
            400,
        );
        assert_eq!(refused["error"]["reason"], "builds-unavailable");
        let publication = app.publish(
            project,
            "gitlab.com/TEAM/SUBGROUP/Catalogue",
            &format!("{:040x}", if plan == Plan::Free { 17 } else { 18 }),
        );
        let read = harness::json(
            app.request(Method::GET, &format!("{path}/publications/{publication}"))
                .send()
                .unwrap(),
            200,
        );
        assert_eq!(read["state"], "ready");
        assert!(read["pullRequest"].is_null());
        let history = harness::json(
            app.request(Method::GET, &format!("{path}/publications"))
                .send()
                .unwrap(),
            200,
        );
        assert!(history["items"][0]["pullRequest"].is_null());
        wait_until(|| app.check_events_are_delivered(publication));
        assert!(app.github.mode.lock().unwrap().check_runs.is_empty());
        if plan == Plan::Free {
            let refused = harness::json(
                app.request(Method::PATCH, &path)
                    .json(&json!({
                        "name":created["name"],"slug":created["slug"],"visibility":"private",
                        "requireApproval":false,"version":1,
                    }))
                    .send()
                    .unwrap(),
                400,
            );
            assert_eq!(refused["error"]["reason"], "plan-required");
        }
    }
    assert!(app.build_requests.lock().unwrap().is_empty());
}

#[test]
fn linked_and_cli_creation_share_case_insensitive_duplicates_in_both_orders() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    for linked_first in [false, true] {
        let workspace = app.workspace(if linked_first {
            "Linked first"
        } else {
            "CLI first"
        });
        connect(&mut app, &workspace, 1, false);
        let installations = list(&app, &workspace);
        let id = installations["items"][0]["id"].as_str().unwrap();
        let repositories = harness::json(
            app.request(
                Method::GET,
                &format!("/v1/github/installations/{id}/repositories"),
            )
            .send()
            .unwrap(),
            200,
        );
        let linked = json!({"name":"Linked","slug":"linked","repositoryId":repositories["items"][0]["id"],"configPath":"mokly.config.json"});
        let cli = json!({"name":"CLI","slug":"cli","repository":"github.com/OCTOCAT/HELLO-WORLD.git","configPath":"mokly.config.json"});
        let path = format!(
            "/v1/workspaces/{}/projects",
            workspace["id"].as_str().unwrap()
        );
        let (first, second) = if linked_first {
            (&linked, &cli)
        } else {
            (&cli, &linked)
        };
        let created = harness::json(
            app.request(Method::POST, &path).json(first).send().unwrap(),
            201,
        );
        let duplicate = harness::json(
            app.request(Method::POST, &path)
                .json(second)
                .send()
                .unwrap(),
            409,
        );
        assert_eq!(duplicate["error"]["reason"], "duplicate-project");
        assert_eq!(
            duplicate["error"]["data"]["existingProjectId"],
            created["id"]
        );
        let mut another_config = cli.clone();
        another_config["slug"] = json!("another-config");
        another_config["configPath"] = json!("other.config.json");
        harness::json(
            app.request(Method::POST, &path)
                .json(&another_config)
                .send()
                .unwrap(),
            201,
        );
        assert_eq!(
            app.request(Method::DELETE, &format!("/v1/github/installations/{id}"))
                .send()
                .unwrap()
                .status(),
            204
        );
    }
}

#[test]
fn repository_creation_validates_identity_config_and_exactly_one_source() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let workspace = app.workspace("Identity validation");
    let path = format!(
        "/v1/workspaces/{}/projects",
        workspace["id"].as_str().unwrap()
    );
    for repository in [
        "",
        "project",
        "GitLab.com/team/project",
        "gitlab.com:443/team/project",
        "gitlab.com/team/../project",
        "github.com/team/group/project",
    ] {
        let refused = harness::json(app.request(Method::POST, &path).json(&json!({"name":"CLI","slug":"cli","repository":repository,"configPath":"mokly.config.json"})).send().unwrap(), 400);
        assert_eq!(refused["error"]["reason"], "validation-failed");
    }
    for extra in [
        json!({"repositoryId":Uuid::nil()}),
        json!({"kind":"cli"}),
        json!({"configPath":"../mokly.config.json"}),
        json!({"repository":null}),
    ] {
        let mut input = json!({"name":"CLI","slug":"cli","repository":"team/project","configPath":"mokly.config.json"});
        input
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let refused = harness::json(
            app.request(Method::POST, &path)
                .json(&input)
                .send()
                .unwrap(),
            400,
        );
        assert_eq!(refused["error"]["reason"], "validation-failed");
    }
    let suggested = harness::json(app.request(Method::GET, &format!("{path}/slug-suggestion?repository=gitlab.com/team/group/Catalogue.git&configPath=mokly.config.json")).send().unwrap(), 200);
    assert_eq!(suggested["slug"], "catalogue");
}
