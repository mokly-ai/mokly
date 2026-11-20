//! Current-head requests, typed refusals and supersession use the real scheduler.

use chrono::Utc;
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::build_state::BuildState;
use reqwest::Method;
use serde_json::json;

use super::super::build_provider::RunMode;
use super::super::harness::{Harness, json as response_json};
use super::support::{build, publication, read, refusal, role, visibility};

#[test]
fn every_request_role_and_direct_grant_uses_current_provider_heads() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let path = format!("/v1/projects/{}/builds", project.id);
    let mut index = 10;
    for direct in [false, true] {
        for member_role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            if direct && member_role == Role::Owner {
                continue;
            }
            role(&app, project.id, Some(member_role), direct);
            index += 1;
            app.github.mode.lock().unwrap().head_sha = Some(format!("{index:040x}"));
            let request = app
                .request(Method::POST, &path)
                .json(&json!({"branch":"feature/catalogue"}))
                .send()
                .unwrap();
            if member_role == Role::Reviewer {
                refusal(request, 403, "permission-denied");
                continue;
            }
            let value = response_json(request, 201);
            assert_eq!(value["state"], "queued");
            assert_eq!(value["trigger"], "request");
            assert_eq!(value["headSha"], format!("{index:040x}"));
            assert_eq!(value["baseRef"], "master");
            assert_eq!(value["canCancel"], true);
            let id = value["id"].as_str().unwrap();
            assert_eq!(
                response_json(
                    app.request(Method::POST, &format!("{path}/{id}/cancel"))
                        .send()
                        .unwrap(),
                    200
                )["state"],
                "cancelled"
            );
        }
    }
    role(&app, project.id, None, false);
    refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"master"}))
            .send()
            .unwrap(),
        403,
        "permission-denied",
    );
}

#[test]
fn request_refusals_cover_unavailable_plan_duplicates_and_pull_eligibility() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let path = format!("/v1/projects/{}/builds", project.id);
    visibility(&app, project.id, Visibility::Private);
    let denied = refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"master"}))
            .send()
            .unwrap(),
        400,
        "plan-required",
    );
    assert_eq!(
        denied["error"]["data"],
        json!({"requiredPlan":"team","feature":"private-projects"})
    );
    app.queries(&mut |q| {
        let workspace_id = q.project(project.id).unwrap().unwrap().organization_id;
        let mut value = q.organization(workspace_id).unwrap().unwrap();
        value.plan = Plan::Team;
        q.save_organization(&value).unwrap();
    });
    app.github.mode.lock().unwrap().head_sha = Some("b".repeat(40));
    let requested = response_json(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"topic"}))
            .send()
            .unwrap(),
        201,
    );
    let active = refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"topic"}))
            .send()
            .unwrap(),
        409,
        "build-already-active",
    );
    assert_eq!(active["error"]["data"]["buildId"], requested["id"]);
    app.github.mode.lock().unwrap().head_sha = Some("c".repeat(40));
    let newer = response_json(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"topic"}))
            .send()
            .unwrap(),
        201,
    );
    let old_id = requested["id"]
        .as_str()
        .unwrap()
        .parse::<uuid::Uuid>()
        .unwrap()
        .into();
    let old = build(&app, project.id, old_id);
    assert_eq!(old.state, BuildState::Superseded);
    assert_eq!(old.superseded_by.unwrap().to_string(), newer["id"]);
    assert_eq!(
        read(&app, project.id, &format!("builds/{old_id}"))["canCancel"],
        false
    );
    let ready = publication(project.id, "ready", 99, Utc::now());
    app.queries(&mut |q| q.insert_publication(&ready).unwrap());
    app.github.mode.lock().unwrap().head_sha = Some(format!("{:040x}", 99));
    let published = refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"ready"}))
            .send()
            .unwrap(),
        409,
        "build-already-published",
    );
    assert_eq!(
        published["error"]["data"]["publicationId"],
        ready.id.to_string()
    );
    for (closed, fork, missing, cause) in [
        (true, false, false, "closed-pull-request"),
        (false, true, false, "fork-pull-request"),
        (false, false, true, "fork-pull-request"),
    ] {
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.closed_pull = closed;
            mode.fork_pull = fork;
            mode.missing_pull_repository = missing;
        }
        let denied = refusal(
            app.request(Method::POST, &path)
                .json(&json!({"pullRequest":42}))
                .send()
                .unwrap(),
            400,
            "build-ineligible",
        );
        assert_eq!(denied["error"]["data"]["cause"], cause);
    }
    {
        let mut mode = app.github.mode.lock().unwrap();
        mode.missing_pull_repository = false;
        mode.head_sha = Some("d".repeat(40));
    }
    let pull = response_json(
        app.request(Method::POST, &path)
            .json(&json!({"pullRequest":42}))
            .send()
            .unwrap(),
        201,
    );
    assert_eq!(pull["baseRef"], "master");
    assert_eq!(pull["pullRequest"]["number"], 42);
    assert_eq!(pull["pullRequest"]["author"], "octocat");
    app.queries(&mut |q| {
        let mut repository = q.github_repository(project.repository).unwrap().unwrap();
        repository.active = false;
        q.save_github_repository(&repository).unwrap();
    });
    refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"topic"}))
            .send()
            .unwrap(),
        400,
        "builds-unavailable",
    );
}

#[test]
fn malformed_bodies_unknown_references_and_provider_failures_keep_transport_reasons() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let path = format!("/v1/projects/{}/builds", project.id);
    for input in [
        json!({}),
        json!({"branch":""}),
        json!({"branch":"x\n"}),
        json!({"branch":"é".repeat(128)}),
        json!({"pullRequest":0}),
        json!({"pullRequest":-1}),
        json!({"pullRequest":1.5}),
        json!({"branch":"x","pullRequest":42}),
        json!({"branch":"x","other":true}),
        json!([]),
        json!(null),
    ] {
        refusal(
            app.request(Method::POST, &path)
                .json(&input)
                .send()
                .unwrap(),
            400,
            "validation-failed",
        );
    }
    refusal(
        app.request(Method::POST, &path)
            .header("Content-Type", "application/json")
            .body("{")
            .send()
            .unwrap(),
        400,
        "validation-failed",
    );
    refusal(
        app.request(Method::POST, &path)
            .header("Content-Type", "text/plain")
            .body("{}")
            .send()
            .unwrap(),
        400,
        "validation-failed",
    );
    refusal(
        app.request(Method::POST, &path)
            .header("Content-Type", "application/json")
            .body(" ".repeat(16_385))
            .send()
            .unwrap(),
        413,
        "payload-too-large",
    );
    refusal(
        app.request(Method::POST, &path)
            .json(&json!({"pullRequest":999}))
            .send()
            .unwrap(),
        404,
        "not-found",
    );
    app.github.mode.lock().unwrap().branch_deleted = true;
    refusal(
        app.request(Method::POST, &path)
            .json(&json!({"branch":"missing"}))
            .send()
            .unwrap(),
        404,
        "not-found",
    );
    app.github.mode.lock().unwrap().branch_deleted = false;
    for (status, reason) in [(429, "rate-limited"), (503, "unavailable")] {
        app.github.mode.lock().unwrap().branch_status = Some(status);
        refusal(
            app.request(Method::POST, &path)
                .json(&json!({"branch":"topic"}))
                .send()
                .unwrap(),
            status,
            reason,
        );
    }
}
