//! Complete sign-in, installation, project and six-event lifecycle over HTTP.

use mkc_store_interface::github_check::CheckRun;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::{Value, json};
use uuid::Uuid;

use super::fixtures;
use super::harness::{Harness, json as response_json};

#[test]
fn recorded_app_completes_sign_in_installation_and_event_lifecycle() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    app.send("installation", "installation", DeliveryStatus::Done);
    let project = app.install_project();
    app.send(
        "installation_repositories",
        "repositories",
        DeliveryStatus::Done,
    );
    app.send("pull_request", "pull_request", DeliveryStatus::Done);
    app.send("push", "push", DeliveryStatus::Done);
    let mut check = CheckRun {
        id: Uuid::now_v7(),
        project_id: project.id,
        repository_id: project.repository,
        github_id: 4,
        head_sha: "a".repeat(40),
        external_id: "publication-fixture".into(),
        rerequested: false,
    };
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .github_project_repository(project.id)
                .unwrap()
                .map(|repository| repository.id),
            Some(project.repository)
        );
        let pulls = queries.github_pull_requests(project.repository).unwrap();
        assert_eq!(pulls.len(), 1);
        assert_eq!(pulls[0].number, 42);
        assert!(pulls[0].open);
        assert_eq!(
            queries.github_branches(project.repository).unwrap()[0].head_sha,
            Some("a".repeat(40))
        );
        queries.save_github_check(&check).unwrap();
    });
    for event in ["check_suite", "check_run"] {
        app.send(event, event, DeliveryStatus::Done);
        app.queries(&mut |queries| {
            assert!(queries.github_check(4).unwrap().unwrap().rerequested);
            check.rerequested = false;
            queries.save_github_check(&check).unwrap();
        });
    }
    let mut foreign: Value = serde_json::from_slice(&fixtures::delivery("check_run")).unwrap();
    foreign["check_run"]["app"]["id"] = json!(999);
    let id = Uuid::now_v7();
    assert_eq!(
        app.webhook(id, "check_run", serde_json::to_vec(&foreign).unwrap(), true)
            .status(),
        202
    );
    app.wait_delivery(id, DeliveryStatus::Ignored);
    app.queries(&mut |queries| assert!(!queries.github_check(4).unwrap().unwrap().rerequested));
    app.github.mode.lock().unwrap().branch_deleted = true;
    app.send("push", "push", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert!(
            queries.github_branches(project.repository).unwrap()[0]
                .head_sha
                .is_none()
        )
    });
    app.github.mode.lock().unwrap().suspended = true;
    app.send("installation", "suspend", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert!(
            !queries
                .github_installation(project.installation)
                .unwrap()
                .unwrap()
                .active
        );
        assert!(
            !queries
                .github_repository(project.repository)
                .unwrap()
                .unwrap()
                .active
        );
        assert!(queries.project(project.id).unwrap().is_some());
    });
    app.github.mode.lock().unwrap().suspended = false;
    app.send("installation", "installation", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert!(
            queries
                .github_installation(project.installation)
                .unwrap()
                .unwrap()
                .connected
        )
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
    app.send(
        "installation_repositories",
        "repositories",
        DeliveryStatus::Done,
    );
    app.queries(&mut |queries| {
        assert!(
            !queries
                .github_installation(project.installation)
                .unwrap()
                .unwrap()
                .connected
        );
        assert!(queries.project(project.id).unwrap().is_some());
    });
    let list = response_json(
        app.request(Method::GET, "/v1/github/installations")
            .send()
            .unwrap(),
        200,
    );
    assert!(list["items"].as_array().unwrap().is_empty());
    app.github.mode.lock().unwrap().uninstalled = true;
    app.send("installation", "uninstall", DeliveryStatus::Done);
    app.queries(&mut |queries| {
        assert!(
            !queries
                .github_installation(project.installation)
                .unwrap()
                .unwrap()
                .active
        )
    });
    assert_eq!(
        app.request(Method::DELETE, "/v1/github/connection")
            .send()
            .unwrap()
            .status(),
        204
    );
    app.queries(&mut |queries| {
        assert!(queries.user_github_identity(app.user).unwrap().is_none());
        assert!(queries.user(app.user).unwrap().is_some());
    });
    println!(
        "GitHub smoke: identity reuse, PKCE, installation proof, projects, all six events, disconnection and uninstall passed"
    );
}
