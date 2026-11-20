//! Pull request and branch reads follow the scenario state.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::mode::Mode;
use crate::received::Received;
use crate::routes::route;

fn read(path: &str) -> Received {
    Received {
        method: "GET".into(),
        path: path.into(),
        body: String::new(),
        accept: Some("application/vnd.github+json".into()),
        api_version: Some("2022-11-28".into()),
        user_agent: Some("Mokly-Cloud-GitHub-App".into()),
        authorization: Some("Bearer token".into()),
    }
}

#[test]
fn the_recorded_pull_request_reflects_the_scenario_and_others_are_absent() {
    let ran = Arc::new(AtomicBool::new(false));
    let hook_ran = ran.clone();
    let mut mode = Mode {
        head_sha: Some("c".repeat(40)),
        fork_pull: true,
        closed_pull: true,
        pull_hook: Some(Box::new(move || hook_ran.store(true, Ordering::SeqCst))),
        ..Mode::default()
    };
    let pull = route(&read("/repos/octocat/Hello-World/pulls/42"), &mut mode).unwrap();
    assert!(ran.load(Ordering::SeqCst));
    assert!(mode.pull_hook.is_none());
    assert_eq!(pull.body["head"]["sha"], "c".repeat(40));
    assert_eq!(pull.body["head"]["repo"]["id"], 999);
    assert_eq!(pull.body["state"], "closed");
    mode.missing_pull_repository = true;
    let deleted = route(&read("/repos/octocat/Hello-World/pulls/42"), &mut mode).unwrap();
    assert!(deleted.body["head"]["repo"].is_null());
    let other = route(&read("/repos/octocat/Hello-World/pulls/7"), &mut mode).unwrap();
    assert_eq!(other.status, 404);
}

#[test]
fn exact_branch_reads_answer_the_requested_branch_by_its_decoded_name() {
    let mut mode = Mode {
        exact_branch_reads: true,
        head_sha: Some("d".repeat(40)),
        ..Mode::default()
    };
    let branch = route(
        &read("/repos/octocat/Hello-World/branches/release%2F2026"),
        &mut mode,
    )
    .unwrap();
    assert_eq!(branch.status, 200);
    assert_eq!(branch.body["name"], "release/2026");
    assert_eq!(branch.body["commit"]["sha"], "d".repeat(40));
}

#[test]
fn a_named_branch_redirects_and_a_branch_status_fails_the_read() {
    let mut mode = Mode {
        branch_name: Some("main".into()),
        ..Mode::default()
    };
    let moved = route(
        &read("/repos/octocat/Hello-World/branches/feature%2Fcatalogue"),
        &mut mode,
    )
    .unwrap();
    assert_eq!(moved.status, 301);
    assert_eq!(
        moved.headers["location"],
        "/repos/octocat/Hello-World/branches/main"
    );
    mode.branch_status = Some(429);
    let limited = route(&read("/repos/octocat/Hello-World/branches/main"), &mut mode).unwrap();
    assert_eq!(limited.status, 429);
    assert_eq!(limited.headers["retry-after"], "1");
    mode.branch_status = Some(503);
    let unavailable = route(&read("/repos/octocat/Hello-World/branches/main"), &mut mode).unwrap();
    assert_eq!(unavailable.status, 503);
    assert!(!unavailable.headers.contains_key("retry-after"));
}

#[test]
fn the_branch_hook_runs_once_with_the_first_branch_read() {
    let ran = Arc::new(AtomicBool::new(false));
    let hook_ran = ran.clone();
    let mut mode = Mode {
        branch_hook: Some(Box::new(move || hook_ran.store(true, Ordering::SeqCst))),
        ..Mode::default()
    };
    route(
        &read("/repos/octocat/Hello-World/branches/feature%2Fcatalogue"),
        &mut mode,
    )
    .unwrap();
    assert!(ran.load(Ordering::SeqCst));
    assert!(mode.branch_hook.is_none());
}
