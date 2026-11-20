//! Guarded observations always return the stored branch or pull request.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_store_interface::github_refs::{Branch, GitHubRefsMock, PullRequest};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::build_head::{BuildHeadRecorder, DatabaseBuildHeadRecorder};
use crate::build_scheduler::BuildReference;

#[test]
fn a_delayed_branch_read_returns_the_newer_stored_head() {
    let observed = Branch {
        repository_id: Uuid::from_u128(1).into(),
        name: "main".into(),
        head_sha: Some("a".repeat(40)),
        updated_at: "2026-10-10T00:00:00Z".parse().unwrap(),
    };
    let mut stored = observed.clone();
    stored.head_sha = Some("b".repeat(40));
    stored.updated_at += chrono::Duration::seconds(1);
    let check = observed.clone();
    let mut queries = Unimock::new((
        GitHubRefsMock::save_github_branch
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, value| {
                assert_eq!(value.updated_at, check.updated_at);
                assert_eq!(value.head_sha, check.head_sha);
                Ok(())
            })),
        GitHubRefsMock::github_branches
            .next_call(matching!(_))
            .returns(Ok(vec![stored])),
    ));
    let recorder: &dyn BuildHeadRecorder = &DatabaseBuildHeadRecorder;
    let Some(BuildReference::Branch(current)) = recorder
        .record(&mut queries, &BuildReference::Branch(observed))
        .unwrap()
    else {
        panic!("stored branch")
    };
    assert_eq!(current.head_sha.as_deref(), Some("b".repeat(40).as_str()));
}

#[test]
fn a_delayed_pull_read_returns_the_newer_stored_state_and_identity() {
    let observed = PullRequest {
        repository_id: Uuid::from_u128(1).into(),
        number: 42,
        title: "Catalogue".into(),
        author: None,
        open: true,
        merged: false,
        head_ref: "topic".into(),
        head_sha: "a".repeat(40),
        base_ref: "main".into(),
        base_sha: "c".repeat(40),
        head_repository_id: Some(100),
        base_repository_id: Some(100),
        updated_at: "2026-10-10T00:00:00Z".parse().unwrap(),
    };
    let mut stored = observed.clone();
    stored.head_sha = "b".repeat(40);
    stored.open = false;
    stored.merged = true;
    let mut queries = Unimock::new((
        GitHubRefsMock::save_github_pull_request
            .next_call(matching!(_))
            .returns(Ok(())),
        GitHubRefsMock::github_pull_requests
            .next_call(matching!(_))
            .returns(Ok(vec![stored])),
    ));
    let recorder: &dyn BuildHeadRecorder = &DatabaseBuildHeadRecorder;
    let Some(BuildReference::PullRequest(current)) = recorder
        .record(&mut queries, &BuildReference::PullRequest(observed))
        .unwrap()
    else {
        panic!("stored pull request")
    };
    assert_eq!(current.head_sha, "b".repeat(40));
    assert!(!current.open);
    assert!(current.merged);
}
