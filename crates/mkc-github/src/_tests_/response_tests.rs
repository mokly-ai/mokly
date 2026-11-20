//! Provider failures and list-only PR fields preserve their actual semantics.

use mkc_github_interface::error::Error;
use mkc_github_interface::pull_requests::PullRequest;
use serde_json::{Value, json};

use crate::response;

use super::fixtures;

#[test]
fn unexpected_provider_status_is_internal_with_its_status_preserved() {
    let mut record = fixtures::response("forbidden");
    record.status = 302;
    assert!(matches!(response::checked(record), Err(Error::Internal(_))));
}

#[test]
fn client_rejections_keep_their_status_for_check_retry_classification() {
    for status in [400, 408, 422] {
        let mut record = fixtures::response("forbidden");
        record.status = status;
        assert!(
            matches!(response::checked(record), Err(Error::Http { status: actual }) if actual == status),
            "HTTP {status} must retain a handled status for the check worker"
        );
    }
}

#[test]
fn closed_merged_prs_from_list_use_merged_at_when_merged_is_absent() {
    let record = fixtures::response("pull-request");
    let mut body: Value = serde_json::from_slice(&record.body).unwrap();
    body.as_object_mut().unwrap().remove("merged");
    body["state"] = json!("closed");
    body["merged_at"] = json!("2026-09-16T12:00:00Z");
    let pull: PullRequest = serde_json::from_value(body.clone()).unwrap();
    assert!(pull.merged);
    body["merged_at"] = Value::Null;
    assert!(!serde_json::from_value::<PullRequest>(body).unwrap().merged);
}

#[test]
fn pull_request_author_is_retained_without_inventing_missing_logins() {
    let record = fixtures::response("pull-request");
    let mut body: Value = serde_json::from_slice(&record.body).unwrap();
    body["user"] = json!({"login": "octocat", "id": 1});
    let pull: PullRequest = serde_json::from_value(body.clone()).unwrap();
    assert_eq!(pull.author.as_deref(), Some("octocat"));
    body.as_object_mut().unwrap().remove("user");
    assert!(
        serde_json::from_value::<PullRequest>(body)
            .unwrap()
            .author
            .is_none()
    );
}
