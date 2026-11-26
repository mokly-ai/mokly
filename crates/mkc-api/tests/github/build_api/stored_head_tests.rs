//! Delayed provider reads must use the newer head recorded by another pool.

use std::sync::{Arc, Mutex};

use chrono::Utc;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::github_refs::Branch;
use mkc_store_interface::store::Callback;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::super::build_provider::RunMode;
use super::super::harness::{Harness, json as response_json};
use super::super::replica::Replica;
use super::support::{publication, refusal};

#[test]
fn two_api_replicas_keep_the_newer_build_when_a_provider_read_is_delayed() {
    for pull in [false, true] {
        let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
            return;
        };
        app.sign_in();
        let project = app.install_project();
        let replica = Replica::start(&app);
        let head = "f".repeat(40);
        let body = if pull {
            json!({"pullRequest":42})
        } else {
            json!({"branch":"replica-race"})
        };
        let newer = replica
            .request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&body);
        let winner = Arc::new(Mutex::new(None));
        let observed = winner.clone();
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.head_sha = Some("e".repeat(40));
            let hook: Box<dyn FnOnce() + Send> = Box::new(move || {
                *observed.lock().unwrap() = Some(response_json(newer.send().unwrap(), 201));
            });
            if pull {
                mode.pull_hook = Some(hook);
            } else {
                mode.branch_hook = Some(hook);
            }
        }
        let response = app
            .request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&body)
            .send()
            .unwrap();
        let refused = refusal(response, 409, "build-already-active");
        let winner = winner.lock().unwrap().take().unwrap();
        assert_eq!(refused["error"]["data"]["buildId"], winner["id"]);
        app.queries(&mut |q| {
            let stored = if pull {
                q.github_pull_requests(project.repository)?
                    .into_iter()
                    .find(|row| row.number == 42)
                    .map(|row| row.head_sha)
            } else {
                q.github_branches(project.repository)?
                    .into_iter()
                    .find(|row| row.name == "replica-race")
                    .and_then(|row| row.head_sha)
            };
            assert_eq!(stored, Some(head.clone()));
            let build = q.active_build(project.id, &head)?.unwrap();
            assert_eq!(build.id.to_string(), winner["id"]);
            assert!(matches!(
                build.state,
                BuildState::Queued | BuildState::Running
            ));
            assert!(q.active_build(project.id, &"e".repeat(40))?.is_none());
            Ok(())
        });
    }
}

#[test]
fn delayed_requests_schedule_and_report_duplicates_on_the_stored_head() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for case in 0..3 {
        let branch = format!("delayed-{case}");
        let current = format!("{:040x}", 150 + case);
        let store = app.replica_store();
        let repository = project.repository;
        let project_id = project.id;
        let winner = Uuid::now_v7();
        let stored_branch = branch.clone();
        let stored_head = current.clone();
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.head_sha = Some(format!("{:040x}", 90 + case));
            mode.branch_hook = Some(Box::new(move || {
                store
                    .transaction(&mut Callback(&mut |q| {
                        q.save_github_branch(&Branch {
                            repository_id: repository,
                            name: stored_branch.clone(),
                            head_sha: Some(stored_head.clone()),
                            updated_at: Utc::now(),
                        })?;
                        match case {
                            1 => q.schedule_build(&NewBuild {
                                id: winner.into(),
                                project_id,
                                repository_id: repository,
                                trigger: BuildTrigger::Request,
                                branch: stored_branch.clone(),
                                head_sha: stored_head.clone(),
                                pull_request: None,
                                base_ref: Some("master".into()),
                                config_path: "mokly.config.json".into(),
                                created_at: Utc::now(),
                            })?,
                            2 => {
                                let mut ready =
                                    publication(project_id, &stored_branch, 150 + case, Utc::now());
                                ready.id = winner.into();
                                q.insert_publication(&ready)?;
                            }
                            _ => {}
                        }
                        Ok(())
                    }))
                    .unwrap();
            }));
        }
        let response = app
            .request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&json!({"branch":branch}))
            .send()
            .unwrap();
        match case {
            0 => assert_eq!(response_json(response, 201)["headSha"], current),
            1 => {
                let value = refusal(response, 409, "build-already-active");
                assert_eq!(value["error"]["data"]["buildId"], winner.to_string());
            }
            _ => {
                let value = refusal(response, 409, "build-already-published");
                assert_eq!(value["error"]["data"]["publicationId"], winner.to_string());
            }
        }
        app.queries(&mut |q| {
            let stored = q
                .github_branches(repository)?
                .into_iter()
                .find(|row| row.name == branch)
                .unwrap();
            assert_eq!(stored.head_sha.as_deref(), Some(current.as_str()));
            if case == 1 {
                assert!(matches!(
                    q.build(project.id, winner.into())?.unwrap().state,
                    BuildState::Queued | BuildState::Running
                ));
            }
            Ok(())
        });
    }
}

#[test]
fn setup_uses_the_stored_head_and_keeps_a_newer_active_build() {
    for already_active in [false, true] {
        let Some(mut app) = Harness::start_with_build_mode(RunMode::Wait) else {
            return;
        };
        app.sign_in();
        let store = app.replica_store();
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.head_sha = Some("e".repeat(40));
            mode.branch_hook = Some(Box::new(move || {
                store
                    .transaction(&mut Callback(&mut |q| {
                        let installation = q.github_installation_by_provider(1)?.unwrap();
                        let repository = q.github_repositories(installation.id)?.remove(0);
                        let project = q.github_repository_projects(repository.id)?.remove(0);
                        q.save_github_branch(&Branch {
                            repository_id: repository.id,
                            name: repository.default_branch.clone(),
                            head_sha: Some("f".repeat(40)),
                            updated_at: Utc::now(),
                        })?;
                        if already_active {
                            q.schedule_build(&NewBuild {
                                id: Uuid::now_v7().into(),
                                project_id: project.id,
                                repository_id: repository.id,
                                trigger: BuildTrigger::Push,
                                branch: repository.default_branch,
                                head_sha: "f".repeat(40),
                                pull_request: None,
                                base_ref: None,
                                config_path: project.config_path,
                                created_at: Utc::now(),
                            })?;
                        }
                        Ok(())
                    }))
                    .unwrap();
            }));
        }
        let project = app.install_project();
        app.queries(&mut |q| {
            let build = q.active_build(project.id, &"f".repeat(40))?.unwrap();
            assert_eq!(
                build.trigger,
                if already_active {
                    BuildTrigger::Push
                } else {
                    BuildTrigger::Setup
                }
            );
            assert!(matches!(
                build.state,
                BuildState::Queued | BuildState::Running
            ));
            assert!(q.active_build(project.id, &"e".repeat(40))?.is_none());
            Ok(())
        });
    }
}
