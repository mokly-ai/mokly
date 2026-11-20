//! Project capabilities, optional settings and best-effort default-branch setup.

use mkc_domain::values::{Role, Visibility};
use reqwest::Method;
use serde_json::{Value, json};

use super::super::build_provider::RunMode;
use super::super::harness::{Harness, json as response_json};
use super::support::{read, refusal, role, visibility};

fn update(value: &Value) -> Value {
    json!({"name":value["name"],"slug":value["slug"],"visibility":value["visibility"],"requireApproval":false,"version":value["version"]})
}

#[test]
fn project_and_slug_capabilities_follow_plan_availability_and_effective_role() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for direct in [false, true] {
        for member_role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            if direct && member_role == Role::Owner {
                continue;
            }
            role(&app, project.id, Some(member_role), direct);
            for private in [false, true] {
                visibility(
                    &app,
                    project.id,
                    if private {
                        Visibility::Private
                    } else {
                        Visibility::Public
                    },
                );
                let value = read(&app, project.id, "");
                assert_eq!(value["automaticBuilds"], true);
                assert_eq!(value["buildsAvailable"], true);
                assert_eq!(
                    value["canRequestBuilds"],
                    !private && member_role >= Role::Member
                );
                assert_eq!(value["publishingAllowed"], !private);
                let slug = response_json(
                    app.request(
                        Method::GET,
                        "/v1/workspaces/by-slug/recorded-github-team/projects/fixture-catalogue",
                    )
                    .send()
                    .unwrap(),
                    200,
                );
                for field in [
                    "automaticBuilds",
                    "buildsAvailable",
                    "canRequestBuilds",
                    "publishingAllowed",
                ] {
                    assert_eq!(value[field], slug[field]);
                }
            }
        }
    }
    visibility(&app, project.id, Visibility::Public);
    role(&app, project.id, None, false);
    for anonymous in [false, true] {
        if anonymous {
            app.cookie.clear();
        }
        let value = read(&app, project.id, "");
        assert_eq!(value["buildsAvailable"], true);
        assert_eq!(value["canRequestBuilds"], false);
        assert_eq!(value["publishingAllowed"], true);
    }
}

#[test]
fn only_administrators_change_automatic_builds_and_an_absent_field_preserves_it() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let path = format!("/v1/projects/{}", project.id);
    for direct in [false, true] {
        for member_role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            if direct && member_role == Role::Owner {
                continue;
            }
            role(&app, project.id, Some(member_role), direct);
            let original = read(&app, project.id, "");
            let mut input = update(&original);
            input["automaticBuilds"] = json!(false);
            let response = app
                .request(Method::PATCH, &path)
                .json(&input)
                .send()
                .unwrap();
            if member_role < Role::Admin {
                refusal(response, 403, "permission-denied");
                continue;
            }
            let changed = response_json(response, 200);
            assert_eq!(changed["automaticBuilds"], false);
            let preserved = response_json(
                app.request(Method::PATCH, &path)
                    .json(&update(&changed))
                    .send()
                    .unwrap(),
                200,
            );
            assert_eq!(preserved["automaticBuilds"], false);
            let mut input = update(&preserved);
            input["automaticBuilds"] = json!(true);
            assert_eq!(
                response_json(
                    app.request(Method::PATCH, &path)
                        .json(&input)
                        .send()
                        .unwrap(),
                    200
                )["automaticBuilds"],
                true
            );
        }
    }
    role(&app, project.id, Some(Role::Owner), false);
    let original = read(&app, project.id, "");
    let mut input = update(&original);
    input["automaticBuilds"] = json!(null);
    refusal(
        app.request(Method::PATCH, &path)
            .json(&input)
            .send()
            .unwrap(),
        400,
        "validation-failed",
    );
    app.queries(&mut |q| {
        let mut installation = q
            .github_installation(project.installation)
            .unwrap()
            .unwrap();
        installation.active = false;
        q.save_github_installation(&installation).unwrap();
    });
    input["automaticBuilds"] = json!(true);
    refusal(
        app.request(Method::PATCH, &path)
            .json(&input)
            .send()
            .unwrap(),
        400,
        "builds-unavailable",
    );
    input["automaticBuilds"] = json!(false);
    let changed = response_json(
        app.request(Method::PATCH, &path)
            .json(&input)
            .send()
            .unwrap(),
        200,
    );
    assert_eq!(changed["automaticBuilds"], false);
    assert_eq!(changed["buildsAvailable"], false);
}

#[test]
fn creation_sets_defaults_schedules_setup_and_tolerates_provider_failure() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let branches = read(&app, project.id, "branches");
    let id = branches["items"][0]["newestBuild"]["id"].as_str().unwrap();
    let setup = read(&app, project.id, &format!("builds/{id}"));
    assert_eq!(setup["trigger"], "setup");
    assert_eq!(setup["branch"], "master");
    assert!(setup["baseRef"].is_null());
    app.github.mode.lock().unwrap().branch_status = Some(503);
    let current = read(&app, project.id, "");
    let failed_setup = response_json(app.request(Method::POST, &format!("/v1/workspaces/{}/projects", current["workspaceId"].as_str().unwrap()))
        .json(&json!({"name":"Second", "slug":"second", "repositoryId":project.repository,"configPath":"second.config.json"})).send().unwrap(), 201);
    let second = failed_setup["id"]
        .as_str()
        .unwrap()
        .parse::<uuid::Uuid>()
        .unwrap()
        .into();
    assert_eq!(failed_setup["automaticBuilds"], true);
    assert!(
        read(&app, second, "history")["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let explicit =
        app.unlinked_project(current["workspaceId"].as_str().unwrap(), "ci", "other/repo");
    assert_eq!(explicit["automaticBuilds"], false);
    assert_eq!(explicit["buildsAvailable"], false);
    let mut input = update(&explicit);
    input["automaticBuilds"] = json!(true);
    refusal(
        app.request(
            Method::PATCH,
            &format!("/v1/projects/{}", explicit["id"].as_str().unwrap()),
        )
        .json(&input)
        .send()
        .unwrap(),
        400,
        "builds-unavailable",
    );
}

#[test]
fn unconfigured_builds_refuse_requests_and_setting_without_contacting_github() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let value = read(&app, project.id, "");
    assert_eq!(value["automaticBuilds"], true);
    assert_eq!(value["buildsAvailable"], false);
    assert_eq!(value["canRequestBuilds"], false);
    assert!(
        read(&app, project.id, "history")["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    refusal(
        app.request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&json!({"branch":"master"}))
            .send()
            .unwrap(),
        400,
        "builds-unavailable",
    );
    let mut input = update(&value);
    input["automaticBuilds"] = json!(true);
    refusal(
        app.request(Method::PATCH, &format!("/v1/projects/{}", project.id))
            .json(&input)
            .send()
            .unwrap(),
        400,
        "builds-unavailable",
    );
    assert!(app.github.mode.lock().unwrap().branch_paths.is_empty());
}
