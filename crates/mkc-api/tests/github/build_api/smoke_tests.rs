//! A requested build uploads a released fixture through the real HTTP exchange.

use reqwest::Method;
use serde_json::json;

use super::super::build_provider::RunMode;
use super::super::check_support::wait_until;
use super::super::harness::{Harness, json as response_json};
use super::support::read;

#[test]
fn requested_build_smoke_polls_logs_and_reads_its_published_history_row() {
    let Some(mut app) = Harness::start_with_build_mode(RunMode::Publish) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let branches = read(&app, project.id, "branches");
    let setup = branches["items"][0]["newestBuild"]["id"].as_str().unwrap();
    wait_until(|| read(&app, project.id, &format!("builds/{setup}"))["state"] == "published");
    app.github.mode.lock().unwrap().head_sha = Some("b".repeat(40));
    let request = response_json(
        app.request(Method::POST, &format!("/v1/projects/{}/builds", project.id))
            .json(&json!({"branch":"feature/catalogue"}))
            .send()
            .unwrap(),
        201,
    );
    let id = request["id"].as_str().unwrap();
    let mut after = 0;
    let mut output = String::new();
    wait_until(|| {
        let log = read(&app, project.id, &format!("builds/{id}/log?after={after}"));
        for chunk in log["chunks"].as_array().unwrap() {
            output.push_str(chunk["text"].as_str().unwrap());
        }
        after = log["nextAfter"].as_i64().unwrap();
        let value = read(&app, project.id, &format!("builds/{id}"));
        value["state"] == "published" && log["complete"] == true
    });
    assert!(output.contains("Recorded build output"));
    let value = read(&app, project.id, &format!("builds/{id}"));
    let history = read(&app, project.id, "history?branch=feature%2Fcatalogue");
    assert_eq!(history["items"].as_array().unwrap().len(), 1);
    let entry = &history["items"][0];
    assert_eq!(entry["kind"], "publication");
    assert_eq!(entry["publication"]["id"], value["publicationId"]);
    assert_eq!(entry["publication"]["buildId"], id);
    assert_eq!(entry["publication"]["state"], "ready");
    assert!(
        entry["publication"]["catalogueUrl"]
            .as_str()
            .unwrap()
            .starts_with("https://p-")
    );
    println!(
        "Build REST smoke: server started with recorded GitHub and fake runner; POST builds, GET build/log polls, real plan/blob/completion uploads, and GET history ready row passed"
    );
}
