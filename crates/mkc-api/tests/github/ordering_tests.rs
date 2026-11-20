//! Concurrent OAuth callbacks and webhooks arriving before repository selection.

use std::thread;
use std::time::{Duration, Instant};

use chrono::Utc;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;
use serde_json::json;
use uuid::Uuid;

use super::fixtures;
use super::harness::{Harness, json as response_json};

#[test]
fn concurrent_callbacks_exchange_the_oauth_code_exactly_once() {
    let Some(app) = Harness::start() else {
        return;
    };
    let start = response_json(
        app.request(Method::POST, "/v1/auth/github")
            .json(&json!({}))
            .send()
            .unwrap(),
        200,
    );
    let input =
        json!({"code":"concurrent","state":start["state"],"codeVerifier":start["codeVerifier"]});
    let first = app
        .request(Method::POST, "/v1/auth/github/callback")
        .json(&input);
    let second = app
        .request(Method::POST, "/v1/auth/github/callback")
        .json(&input);
    let thread = thread::spawn(move || first.send().unwrap().status().as_u16());
    let second = second.send().unwrap().status().as_u16();
    let mut statuses = [thread.join().unwrap(), second];
    statuses.sort();
    assert_eq!(statuses, [200, 400]);
    assert_eq!(app.github.mode.lock().unwrap().oauth_requests, 1);
}

#[test]
fn push_waits_for_a_repository_selection_delivery_that_arrives_later() {
    let Some(app) = Harness::start() else {
        return;
    };
    app.github.mode.lock().unwrap().no_repositories = true;
    app.send("installation", "installation", DeliveryStatus::Done);
    let id = Uuid::now_v7();
    assert_eq!(
        app.webhook(id, "push", fixtures::delivery("push"), true)
            .status(),
        202
    );
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let delivery = app.delivery(id).unwrap();
        if delivery.status == DeliveryStatus::Pending && delivery.attempts == 1 {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "early push was lost: {delivery:?}"
        );
        thread::sleep(Duration::from_millis(25));
    }
    app.github.mode.lock().unwrap().no_repositories = false;
    app.send(
        "installation_repositories",
        "repositories",
        DeliveryStatus::Done,
    );
    app.queries(&mut |queries| {
        let mut delivery = queries.github_delivery(id).unwrap().unwrap();
        delivery.due_at = Utc::now();
        queries.save_github_delivery(&delivery).unwrap();
    });
    assert_eq!(app.wait_delivery(id, DeliveryStatus::Done).attempts, 2);
}
