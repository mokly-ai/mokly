//! Serializable scheduling rechecks rules after the external provider read.

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::Utc;
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::store::Callback;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::super::build_provider::RunMode;
use super::super::harness::{Harness, json as response_json};
use super::support::{publication, read, refusal};

#[test]
fn requests_recheck_access_plan_and_duplicate_heads_after_the_provider_read() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for (case, status, reason) in [
        (0, 400, "builds-unavailable"),
        (1, 400, "plan-required"),
        (2, 403, "permission-denied"),
        (3, 409, "build-already-active"),
        (4, 409, "build-already-published"),
    ] {
        let head = format!("{:040x}", 50 + case);
        let store = app.store.clone();
        let project_id = project.id;
        let repository = project.repository;
        let installation = project.installation;
        let actor = app.user;
        let head_for_hook = head.clone();
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.head_sha = Some(head);
            mode.branch_hook = Some(Box::new(move || {
                store
                    .transaction(&mut Callback(&mut |q| {
                        match case {
                            0 => {
                                let mut value = q.github_installation(installation)?.unwrap();
                                value.connected = false;
                                q.save_github_installation(&value)?;
                            }
                            1 => {
                                let mut value = q.project(project_id)?.unwrap();
                                value.visibility = Visibility::Private;
                                q.save_project(&value)?;
                            }
                            2 => {
                                let workspace = q.project(project_id)?.unwrap().organization_id;
                                for mut member in q.members(workspace)? {
                                    if member.user_id == Some(actor) {
                                        member.role = Role::Reviewer;
                                        q.save_member(&member)?;
                                    }
                                }
                                for grant in q.grants(project_id)? {
                                    if grant.user_id == actor {
                                        q.delete_grant(grant.id)?;
                                    }
                                }
                            }
                            3 => q.schedule_build(&NewBuild {
                                id: Uuid::now_v7().into(),
                                project_id,
                                repository_id: repository,
                                trigger: BuildTrigger::Request,
                                branch: "topic".into(),
                                head_sha: head_for_hook.clone(),
                                pull_request: None,
                                base_ref: Some("master".into()),
                                config_path: "mokly.config.json".into(),
                                created_at: Utc::now(),
                            })?,
                            4 => q.insert_publication(&publication(
                                project_id,
                                "topic",
                                50 + case,
                                Utc::now(),
                            ))?,
                            _ => unreachable!(),
                        }
                        Ok(())
                    }))
                    .unwrap();
            }));
        }
        refusal(
            app.request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
                .json(&json!({"branch":"topic"}))
                .send()
                .unwrap(),
            status,
            reason,
        );
        assert!(app.github.mode.lock().unwrap().branch_hook.is_none());
        app.queries(&mut |q| {
            let mut installation = q.github_installation(project.installation)?.unwrap();
            installation.connected = true;
            q.save_github_installation(&installation)?;
            let mut current = q.project(project.id)?.unwrap();
            current.visibility = Visibility::Public;
            q.save_project(&current)?;
            for mut member in q.members(current.organization_id)? {
                if member.user_id == Some(app.user) {
                    member.role = Role::Owner;
                    q.save_member(&member)?;
                }
            }
            Ok(())
        });
    }
}

#[test]
fn concurrent_requests_create_one_build_and_report_the_winner() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    app.github.mode.lock().unwrap().head_sha = Some("f".repeat(40));
    let barrier = Arc::new(Barrier::new(2));
    let requests: Vec<_> = (0..2)
        .map(|_| {
            let request = app
                .request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
                .json(&json!({"branch":"topic"}));
            let barrier = barrier.clone();
            thread::spawn(move || {
                barrier.wait();
                request.send().unwrap()
            })
        })
        .collect();
    let mut responses: Vec<_> = requests
        .into_iter()
        .map(|request| request.join().unwrap())
        .collect();
    responses.sort_by_key(|response| response.status());
    let conflict = responses.pop().unwrap();
    let winner = response_json(responses.pop().unwrap(), 201);
    let refused = refusal(conflict, 409, "build-already-active");
    assert_eq!(refused["error"]["data"]["buildId"], winner["id"]);
    assert_eq!(
        read(&app, project.id, "history?branch=topic")["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn setup_rechecks_automatic_builds_after_resolving_the_default_branch() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let workspace = read(&app, project.id, "")["workspaceId"]
        .as_str()
        .unwrap()
        .to_owned();
    let store = app.store.clone();
    let workspace_id = workspace.parse::<Uuid>().unwrap().into();
    app.github.mode.lock().unwrap().branch_hook = Some(Box::new(move || {
        store
            .transaction(&mut Callback(&mut |q| {
                let mut created = q
                    .projects(workspace_id)?
                    .into_iter()
                    .find(|row| row.config_path == "setup.config.json")
                    .unwrap();
                created.automatic_builds = false;
                q.save_project(&created)?;
                Ok(())
            }))
            .unwrap();
    }));
    let created = response_json(app.request(Method::POST, &format!("/v1/workspaces/{workspace}/projects"))
        .json(&json!({"name":"Setup race","slug":"setup-race","repositoryId":project.repository,"configPath":"setup.config.json"})).send().unwrap(), 201);
    let id = created["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into();
    assert_eq!(read(&app, id, "")["automaticBuilds"], false);
    assert_eq!(read(&app, id, "history")["items"], json!([]));
}

#[test]
fn requested_builds_ignore_automatic_setting_and_use_the_current_comparison_base() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    app.queries(&mut |q| {
        let mut current = q.project(project.id)?.unwrap();
        current.automatic_builds = false;
        q.save_project(&current)?;
        let mut repository = q.github_repository(project.repository)?.unwrap();
        repository.default_branch = "main".into();
        q.save_github_repository(&repository)?;
        Ok(())
    });
    assert_eq!(read(&app, project.id, "")["canRequestBuilds"], true);
    for (index, branch, base) in [(10, "main", None), (11, "topic", Some("main"))] {
        app.github.mode.lock().unwrap().head_sha = Some(format!("{index:040x}"));
        let requested = response_json(
            app.request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
                .json(&json!({"branch":branch}))
                .send()
                .unwrap(),
            201,
        );
        assert_eq!(requested["baseRef"], json!(base));
        assert_eq!(requested["branch"], branch);
        assert_eq!(requested["trigger"], "request");
    }
}
