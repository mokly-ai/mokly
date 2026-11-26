//! Repository metadata recovery through authenticated deliveries and live snapshots.

use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use super::fixtures;
use super::harness::{Harness, json as response_json};

#[test]
fn recorded_repository_delivery_retains_rename_shape() {
    let payload: Value = serde_json::from_slice(&fixtures::delivery("repository")).unwrap();
    assert_eq!(payload["action"], "renamed");
    assert_eq!(
        payload["changes"]["repository"]["name"]["from"],
        "Hello-World"
    );
    assert_eq!(payload["repository"]["name"], "Renamed");
    assert_eq!(payload["installation"]["id"], 1);
    for field in ["ref", "before", "after", "commits"] {
        assert!(payload.get(field).is_none(), "push-only field: {field}");
    }
}

#[test]
fn renamed_push_updates_storage_and_addresses_the_new_provider_name() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let requests = {
        let mut mode = app.github.mode.lock().unwrap();
        mode.repository_name = Some("octocat/Renamed".into());
        mode.private = true;
        mode.repository_requests
    };
    let mut push: Value = serde_json::from_slice(&fixtures::delivery("push")).unwrap();
    push["repository"]["full_name"] = json!("octocat/Renamed");
    push["repository"]["private"] = json!(true);
    let body = serde_json::to_vec(&push).unwrap();
    assert_eq!(
        app.webhook(Uuid::now_v7(), "push", body.clone(), false)
            .status(),
        401
    );
    app.queries(&mut |queries| {
        let stored = queries.github_repository(project.repository)?.unwrap();
        assert_eq!(stored.full_name, "octocat/Hello-World");
        assert!(!stored.private);
        Ok(())
    });
    let id = Uuid::now_v7();
    assert_eq!(app.webhook(id, "push", body.clone(), true).status(), 202);
    assert_eq!(app.wait_delivery(id, DeliveryStatus::Done).attempts, 1);
    app.queries(&mut |queries| {
        let stored = queries.github_repository(project.repository)?.unwrap();
        assert_eq!(stored.full_name, "octocat/Renamed");
        assert!(stored.private);
        assert_eq!(queries.github_branches(project.repository)?.len(), 1);
        Ok(())
    });
    let list = response_json(
        app.request(
            Method::GET,
            &format!(
                "/v1/github/installations/{}/repositories",
                project.installation
            ),
        )
        .send()
        .unwrap(),
        200,
    );
    assert_eq!(list["items"][0]["fullName"], "octocat/Renamed");
    assert_eq!(list["items"][0]["private"], true);
    assert_eq!(app.webhook(id, "push", body, true).status(), 202);
    let mode = app.github.mode.lock().unwrap();
    assert_eq!(
        mode.repository_requests, requests,
        "metadata refresh must not fetch a snapshot"
    );
    assert_eq!(
        mode.branch_paths,
        ["/repos/octocat/Renamed/branches/feature%2Fcatalogue"]
    );
}

#[test]
fn repository_lifecycle_actions_reconcile_the_current_selection() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for action in [
        "renamed",
        "transferred",
        "privatized",
        "publicized",
        "archived",
        "unarchived",
        "deleted",
        "created",
    ] {
        let requests = {
            let mut mode = app.github.mode.lock().unwrap();
            mode.repository_name = Some(format!("new-owner/{action}"));
            mode.private = action == "privatized";
            mode.no_repositories = action == "deleted";
            mode.repository_requests
        };
        let mut payload: Value = serde_json::from_slice(&fixtures::delivery("repository")).unwrap();
        payload["action"] = json!(action);
        let id = Uuid::now_v7();
        assert_eq!(
            app.webhook(
                id,
                "repository",
                serde_json::to_vec(&payload).unwrap(),
                true
            )
            .status(),
            202
        );
        assert_eq!(app.wait_delivery(id, DeliveryStatus::Done).attempts, 1);
        assert_eq!(
            app.github.mode.lock().unwrap().repository_requests,
            requests + 1
        );
        app.queries(&mut |queries| {
            let stored = queries.github_repository(project.repository)?.unwrap();
            assert_eq!(stored.active, action != "deleted");
            if stored.active {
                assert_eq!(stored.full_name, format!("new-owner/{action}"));
                assert_eq!(stored.private, action == "privatized");
            }
            assert!(queries.project(project.id)?.is_some());
            Ok(())
        });
    }
}

#[test]
fn ignored_repository_actions_still_refresh_metadata_without_provider_requests() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let requests = app.github.mode.lock().unwrap().repository_requests;
    for (event, fixture) in [
        ("pull_request", "pull_request"),
        ("check_run", "check_run"),
        ("check_suite", "check_suite"),
        ("repository", "repository"),
        ("push", "push"),
    ] {
        let name = format!("new-owner/{event}");
        let mut payload: Value = serde_json::from_slice(&fixtures::delivery(fixture)).unwrap();
        payload["repository"]["full_name"] = json!(name);
        payload["repository"]["private"] = json!(true);
        payload["action"] = json!("unsupported");
        if event == "push" {
            payload["ref"] = json!("refs/tags/v1");
        }
        let id = Uuid::now_v7();
        assert_eq!(
            app.webhook(id, event, serde_json::to_vec(&payload).unwrap(), true)
                .status(),
            202
        );
        app.wait_delivery(id, DeliveryStatus::Ignored);
        app.queries(&mut |queries| {
            let stored = queries.github_repository(project.repository)?.unwrap();
            assert_eq!(stored.full_name, name);
            assert!(stored.private);
            Ok(())
        });
    }
    let mode = app.github.mode.lock().unwrap();
    assert_eq!(mode.repository_requests, requests);
    assert!(mode.branch_paths.is_empty());
}

#[test]
fn recorded_repository_edit_reconciles_the_current_default_branch() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    app.github.mode.lock().unwrap().default_branch = Some("current-default".into());
    let id = Uuid::now_v7();
    assert_eq!(
        app.webhook(
            id,
            "repository",
            fixtures::delivery("repository-edited"),
            true
        )
        .status(),
        202
    );
    app.wait_delivery(id, DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .github_repository(project.repository)?
                .unwrap()
                .default_branch,
            "current-default"
        );
        Ok(())
    });
}
