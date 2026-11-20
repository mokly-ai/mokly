//! A repository creation can introduce a selection without a separate selection event.

use mkc_store_interface::github_state::DeliveryStatus;
use serde_json::{Value, json};
use uuid::Uuid;

use super::fixtures;
use super::harness::Harness;

#[test]
fn created_repository_is_discovered_under_an_all_repositories_installation() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    app.github.mode.lock().unwrap().all_repositories = true;
    let project = app.install_project();
    let mut payload: Value = serde_json::from_slice(&fixtures::delivery("repository")).unwrap();
    payload["action"] = json!("created");
    payload.as_object_mut().unwrap().remove("changes");
    payload["repository"]["id"] = json!(1296270);
    payload["repository"]["name"] = json!("New");
    payload["repository"]["full_name"] = json!("octocat/New");
    let requests = {
        let mut mode = app.github.mode.lock().unwrap();
        mode.repository_id = Some(1296270);
        mode.repository_name = Some("octocat/New".into());
        mode.repository_requests
    };
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
        let repositories = queries.github_repositories(project.installation).unwrap();
        let created = repositories
            .iter()
            .find(|row| row.github_id == 1296270)
            .unwrap();
        assert!(created.active);
        assert_eq!(created.full_name, "octocat/New");
        assert_ne!(created.id, project.repository);
        assert!(queries.project(project.id).unwrap().is_some());
    });
}
