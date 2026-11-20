//! Membership, direct grants and session transport do not expose private build data.

use chrono::Utc;
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use reqwest::blocking::Client;
use serde_json::json;
use uuid::Uuid;

use crate::contract_client::ContractRequest;

use super::super::harness::Harness;
use super::support::{read, refusal, role, schedule, visibility};

#[test]
fn build_reads_and_rows_require_membership_for_every_role_and_direct_grant() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    app.send("pull_request", "pull_request", DeliveryStatus::Done);
    let build = schedule(&app, &project, "build-only", 1, Some(42), Utc::now());
    visibility(&app, project.id, Visibility::Private);
    for direct in [false, true] {
        for member_role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
            if direct && member_role == Role::Owner {
                continue;
            }
            role(&app, project.id, Some(member_role), direct);
            let value = read(&app, project.id, &format!("builds/{build}"));
            assert_eq!(value["id"], build.to_string());
            assert_eq!(value["pullRequest"]["number"], 42);
            assert_eq!(value["canCancel"], member_role >= Role::Member);
            assert!(
                read(&app, project.id, &format!("builds/{build}/log"))["chunks"]
                    .as_array()
                    .unwrap()
                    .is_empty()
            );
            assert_eq!(
                read(&app, project.id, "history")["items"][0]["kind"],
                "build"
            );
            assert_eq!(
                read(&app, project.id, "branches")["items"][0]["newestBuild"]["id"],
                build.to_string()
            );
            assert_eq!(
                read(&app, project.id, "pull-requests")["items"][0]["newestBuild"]["id"],
                build.to_string()
            );
        }
    }
    role(&app, project.id, None, false);
    for public in [false, true] {
        visibility(
            &app,
            project.id,
            if public {
                Visibility::Public
            } else {
                Visibility::Private
            },
        );
        for anonymous in [false, true] {
            let cookie = app.cookie.clone();
            if anonymous {
                app.cookie.clear();
            }
            for tail in [format!("builds/{build}"), format!("builds/{build}/log")] {
                refusal(
                    app.request(Method::GET, &format!("/v1/projects/{}/{tail}", project.id))
                        .send()
                        .unwrap(),
                    404,
                    "not-found",
                );
            }
            if public {
                assert!(
                    read(&app, project.id, "history")["items"]
                        .as_array()
                        .unwrap()
                        .is_empty()
                );
                assert_eq!(
                    read(&app, project.id, "branches")["items"][0]["newestBuild"],
                    json!(null)
                );
                assert_eq!(
                    read(&app, project.id, "pull-requests")["items"][0]["newestBuild"],
                    json!(null)
                );
                let value = read(&app, project.id, "");
                assert_eq!(value["canRequestBuilds"], false);
            } else {
                refusal(
                    app.request(Method::GET, &format!("/v1/projects/{}/history", project.id))
                        .send()
                        .unwrap(),
                    404,
                    "not-found",
                );
            }
            app.cookie = cookie;
        }
    }
}

#[test]
fn writes_require_session_origin_and_csrf_and_ids_stay_project_scoped() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let build = schedule(&app, &project, "topic", 1, None, Utc::now());
    let client = Client::new();
    let root = format!("{}/v1/projects/{}", app.origin, project.id);
    for path in [
        format!("{root}/builds"),
        format!("{root}/builds/{build}/cancel"),
    ] {
        let request_body = path.ends_with("/builds").then(|| json!({"branch":"topic"}));
        for case in 0..5 {
            let mut request = ContractRequest::new(&client, Method::POST, path.clone());
            if let Some(body) = &request_body {
                request = request.json(body);
            }
            if case != 0 {
                request = request.header(
                    "Cookie",
                    if case == 1 {
                        "mkc_session=invalid"
                    } else {
                        &app.cookie
                    },
                );
            }
            if case != 2 {
                request = request.header(
                    "Origin",
                    if case == 3 {
                        "https://wrong.example.com"
                    } else {
                        "https://app.example.com"
                    },
                );
            }
            if case != 4 {
                request = request.header("X-CSRF-Token", &app.csrf);
            }
            refusal(
                request.send().unwrap(),
                if case <= 1 { 401 } else { 403 },
                if case <= 1 {
                    "unauthenticated"
                } else {
                    "csrf-rejected"
                },
            );
        }
    }
    for tail in [
        "history".to_owned(),
        format!("builds/{build}"),
        format!("builds/{build}/log"),
    ] {
        refusal(
            ContractRequest::new(&client, Method::GET, format!("{root}/{tail}"))
                .header("Cookie", "mkc_session=invalid")
                .send()
                .unwrap(),
            401,
            "unauthenticated",
        );
    }
    let workspace = app.workspace("Other builds");
    let other = app.seeded_project(workspace["id"].as_str().unwrap(), "other", "other/repo");
    for tail in [
        format!("builds/{build}"),
        format!("builds/{build}/log"),
        format!("builds/{}", Uuid::now_v7()),
    ] {
        refusal(
            app.request(
                Method::GET,
                &format!("/v1/projects/{}/{tail}", other["id"].as_str().unwrap()),
            )
            .send()
            .unwrap(),
            404,
            "not-found",
        );
    }
    refusal(
        app.request(
            Method::POST,
            &format!(
                "/v1/projects/{}/builds/{build}/cancel",
                other["id"].as_str().unwrap()
            ),
        )
        .send()
        .unwrap(),
        404,
        "not-found",
    );
    refusal(
        app.request(
            Method::GET,
            &format!("/v1/projects/{}/builds/bad", project.id),
        )
        .send()
        .unwrap(),
        400,
        "validation-failed",
    );
    refusal(
        app.request(
            Method::POST,
            &format!("/v1/projects/{}/builds/{build}/cancel", project.id),
        )
        .json(&json!({}))
        .send()
        .unwrap(),
        400,
        "validation-failed",
    );
}
