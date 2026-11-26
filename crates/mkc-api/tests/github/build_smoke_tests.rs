//! Signed webhook scheduling, real worker execution and build check HTTP delivery.

use mkc_build_interface::request::Comparison;
use mkc_domain::ids::ProjectId;
use mkc_domain::values::Visibility;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildTrigger};
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use super::check_support::wait_until;
use super::fixtures;
use super::harness::Harness;

fn enable(app: &Harness, project: ProjectId) {
    app.queries(&mut |queries| {
        let mut value = queries.project(project)?.unwrap();
        value.automatic_builds = true;
        value.visibility = Visibility::Public;
        queries.save_project(&value)?;
        Ok(())
    });
}

fn latest(app: &Harness, project: ProjectId, pull: bool) -> Option<Build> {
    let mut value = None;
    app.queries(&mut |queries| {
        let summary = if pull {
            queries
                .viewer_pull_requests(project, None, 100)?
                .into_iter()
                .find(|row| row.key.number == 42)
                .and_then(|row| row.newest_build)
        } else {
            queries
                .viewer_branches(project, None, 100)?
                .into_iter()
                .find(|row| row.key.name == "master")
                .and_then(|row| row.newest_build)
        };
        if let Some(summary) = summary {
            value = queries.build(project, summary.id)?;
        }
        Ok(())
    });
    value
}

fn send(app: &Harness, event: &str, body: Value) {
    let id = Uuid::now_v7();
    assert_eq!(
        app.webhook(id, event, serde_json::to_vec(&body).unwrap(), true)
            .status(),
        202
    );
    app.wait_delivery(id, DeliveryStatus::Done);
}

fn terminal(app: &Harness, project: ProjectId, head: &str, pull: bool) -> Build {
    wait_until(|| {
        latest(app, project, pull)
            .is_some_and(|build| build.head_sha == head && build.state == BuildState::Failed)
    });
    let build = latest(app, project, pull).unwrap();
    assert_eq!(
        build.failure_cause,
        Some(BuildFailure::UnsupportedMoklyVersion)
    );
    assert!(build.log_complete);
    app.queries(&mut |queries| {
        let log = queries.build_log(project, build.id, 0, 100)?.unwrap();
        assert_eq!(log.chunks[0].bytes, b"Recorded build output\n");
        Ok(())
    });
    wait_until(|| {
        app.github
            .mode
            .lock()
            .unwrap()
            .check_runs
            .iter()
            .any(|check| {
                check["external_id"] == format!("mokly-build:{}", build.id)
                    && check["status"] == "completed"
            })
    });
    let mode = app.github.mode.lock().unwrap();
    let check = mode
        .check_runs
        .iter()
        .find(|check| check["external_id"] == format!("mokly-build:{}", build.id))
        .unwrap();
    assert_eq!(check["conclusion"], "failure");
    assert!(
        check["details_url"]
            .as_str()
            .unwrap()
            .ends_with(&format!("/builds/{}", build.id))
    );
    build
}

#[test]
fn configured_api_schedules_current_push_and_pull_heads_and_delivers_checks() {
    let Some(mut app) = Harness::start_with_builds() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let setup = latest(&app, project.id, false).unwrap();
    let setup = terminal(&app, project.id, &setup.head_sha, false);
    assert_eq!(setup.trigger, BuildTrigger::Setup);
    enable(&app, project.id);
    {
        let mut mode = app.github.mode.lock().unwrap();
        mode.branch_name = Some("master".into());
        mode.head_sha = Some("b".repeat(40));
    }
    let mut push: Value = serde_json::from_slice(&fixtures::delivery("push")).unwrap();
    push["ref"] = json!("refs/heads/master");
    send(&app, "push", push.clone());
    let build = terminal(&app, project.id, &"b".repeat(40), false);
    assert_eq!(build.trigger, BuildTrigger::Push);
    assert!(build.base_ref.is_none());
    assert_ne!(build.head_sha, push["after"].as_str().unwrap());
    for (action, head) in [("opened", 'c'), ("reopened", 'd'), ("synchronize", 'e')] {
        let head = head.to_string().repeat(40);
        app.github.mode.lock().unwrap().head_sha = Some(head.clone());
        let mut pull: Value = serde_json::from_slice(&fixtures::delivery("pull_request")).unwrap();
        pull["action"] = json!(action);
        send(&app, "pull_request", pull);
        let build = terminal(&app, project.id, &head, true);
        assert_eq!(build.trigger, BuildTrigger::PullRequest);
        assert_eq!(build.pull_request, Some(42));
        assert_eq!(build.base_ref.as_deref(), Some("master"));
    }
    let runs = app.build_requests.lock().unwrap();
    assert_eq!(runs.len(), 5);
    assert_eq!(runs[0].build, setup.id.0);
    assert_eq!(runs[0].comparison, Comparison::CurrentOnly);
    assert_eq!(runs[1].build, build.id.0);
    assert_eq!(runs[1].head, "b".repeat(40));
    assert_eq!(runs[1].branch, "master");
    assert_eq!(runs[1].comparison, Comparison::CurrentOnly);
    assert!(runs[2..].iter().all(|run| matches!(&run.comparison, Comparison::Base { base_ref } if base_ref.as_str() == "master")));
    assert_eq!(app.github.mode.lock().unwrap().scoped_token_requests, 5);
    assert_eq!(
        app.request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&json!({"branch":"master"}))
            .send()
            .unwrap()
            .status(),
        201
    );
    println!(
        "Build smoke: setup, signed push and PRs, current heads, scoped tokens, logs, checks and REST request passed"
    );
}

#[test]
fn forks_missing_head_repositories_closed_and_other_pull_actions_schedule_nothing() {
    let Some(mut app) = Harness::start_with_builds() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let setup = latest(&app, project.id, false).unwrap();
    terminal(&app, project.id, &setup.head_sha, false);
    enable(&app, project.id);
    for case in 0..4 {
        {
            let mut mode = app.github.mode.lock().unwrap();
            mode.fork_pull = case == 0;
            mode.missing_pull_repository = case == 1;
            mode.closed_pull = case == 2;
        }
        let mut pull: Value = serde_json::from_slice(&fixtures::delivery("pull_request")).unwrap();
        if case == 3 {
            pull["action"] = json!("edited");
        }
        send(&app, "pull_request", pull);
        assert!(latest(&app, project.id, true).is_none());
        assert_eq!(app.build_requests.lock().unwrap().len(), 1);
    }
}

#[test]
fn unconfigured_api_reconciles_webhooks_without_builds() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    enable(&app, project.id);
    app.send("pull_request", "pull_request", DeliveryStatus::Done);
    app.send("push", "push", DeliveryStatus::Done);
    assert!(latest(&app, project.id, true).is_none());
    assert!(app.build_requests.lock().unwrap().is_empty());
    assert_eq!(app.github.mode.lock().unwrap().scoped_token_requests, 0);
}
