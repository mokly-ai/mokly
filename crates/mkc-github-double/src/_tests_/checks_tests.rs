//! Check runs are stored on create, listed per commit and updated in place.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::{Value, json};

use crate::error::Error;
use crate::mode::Mode;
use crate::received::Received;
use crate::routes::route;

const ROOT: &str = "/repos/octocat/Hello-World";

fn request(method: &str, path: &str, body: Value) -> Received {
    Received {
        method: method.into(),
        path: path.into(),
        body: if body.is_null() {
            String::new()
        } else {
            body.to_string()
        },
        accept: Some("application/vnd.github+json".into()),
        api_version: Some("2022-11-28".into()),
        user_agent: Some("Mokly-Cloud-GitHub-App".into()),
        authorization: Some("Bearer token".into()),
    }
}

fn create(external: &str) -> Received {
    request(
        "POST",
        &format!("{ROOT}/check-runs"),
        json!({
            "name": "Mokly",
            "head_sha": "a".repeat(40),
            "external_id": external,
            "details_url": "https://app.example.com/acme/catalogue",
            "status": "in_progress",
            "output": { "title": "Publishing", "summary": "Publishing" },
        }),
    )
}

fn list(sha: &str) -> Received {
    request(
        "GET",
        &format!(
            "{ROOT}/commits/{sha}/check-runs?check_name=Mokly&app_id=123&filter=all&per_page=100&page=1"
        ),
        Value::Null,
    )
}

#[test]
fn a_created_run_is_listed_on_its_commit_and_updated_in_place() {
    let mut mode = Mode::default();
    let created = route(&create("mokly-publication:1"), &mut mode).unwrap();
    assert_eq!(created.body["id"], 4);
    assert_eq!(created.body["status"], "in_progress");
    assert_eq!(mode.check_creates, 1);

    let listed = route(&list(&"a".repeat(40)), &mut mode).unwrap();
    assert_eq!(listed.body["total_count"], 1);
    assert_eq!(
        listed.body["check_runs"][0]["external_id"],
        "mokly-publication:1"
    );
    let other = route(&list(&"b".repeat(40)), &mut mode).unwrap();
    assert_eq!(other.body["total_count"], 0);
    assert_eq!(mode.check_lists, 2);

    let updated = route(
        &request(
            "PATCH",
            &format!("{ROOT}/check-runs/4"),
            json!({ "status": "completed", "conclusion": "success" }),
        ),
        &mut mode,
    )
    .unwrap();
    assert_eq!(updated.body["conclusion"], "success");
    assert_eq!(mode.check_runs[0]["status"], "completed");
    assert_eq!(mode.check_updates, 1);
}

#[test]
fn a_lost_create_keeps_the_run_and_marks_the_answer_dropped() {
    let mut mode = Mode {
        lose_create_response: true,
        ..Mode::default()
    };
    route(&create("mokly-build:1"), &mut mode).unwrap();
    assert!(mode.drop_check_response);
    assert!(!mode.lose_create_response);
    assert_eq!(mode.check_runs.len(), 1);
}

#[test]
fn a_run_outside_the_contract_is_refused() {
    let mut mode = Mode::default();
    let foreign = route(&create("other:1"), &mut mode).unwrap_err();
    assert!(matches!(
        foreign,
        Error::Field {
            name: "external_id"
        }
    ));
    let unconcluded = route(
        &request(
            "POST",
            &format!("{ROOT}/check-runs"),
            json!({ "name": "Mokly", "external_id": "mokly-build:1", "status": "completed" }),
        ),
        &mut mode,
    )
    .unwrap_err();
    assert!(matches!(unconcluded, Error::Field { name: "conclusion" }));
    let mut renamed = Mode {
        repository_name: Some("octocat/Renamed".into()),
        ..Mode::default()
    };
    assert!(matches!(
        route(&create("mokly-build:1"), &mut renamed).unwrap_err(),
        Error::Unrecorded { .. }
    ));
    let missing = route(
        &request(
            "PATCH",
            &format!("{ROOT}/check-runs/99"),
            json!({ "status": "in_progress" }),
        ),
        &mut mode,
    )
    .unwrap();
    assert_eq!(missing.status, 404);
    let unfiltered = request(
        "GET",
        &format!("{ROOT}/commits/{}/check-runs", "a".repeat(40)),
        Value::Null,
    );
    assert!(matches!(
        route(&unfiltered, &mut mode).unwrap_err(),
        Error::Unrecorded { .. }
    ));
}
