//! Recovery reads include every run for the configured App, with bounded pagination.

use mkc_github_interface::checks::Checks;
use mkc_github_interface::error::Error;
use mkc_github_interface::http::{HttpMock, Method};
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{api, client, installation_client, recorded, response};

fn path(page: usize) -> String {
    format!(
        "/repos/octocat/Hello-World/commits/{}/check-runs?check_name=Mokly&app_id=123&filter=all&per_page=100&page={page}",
        "a".repeat(40)
    )
}

#[test]
fn list_filters_by_name_app_and_all_runs() {
    let github = installation_client(recorded(vec![(
        Method::Get,
        api(&path(1)),
        response("check-list"),
    )]));
    let runs = Checks::list(&github, 1, "octocat/Hello-World", &"a".repeat(40), 123).unwrap();
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].id, 4);
    assert_eq!(runs[0].external_id.as_deref(), Some("publication-fixture"));
}

#[test]
fn list_reads_later_pages_without_following_provider_links() {
    let mut first = response("check-list");
    let mut body: Value = serde_json::from_slice(&first.body).unwrap();
    body["check_runs"] = json!(vec![body["check_runs"][0].clone(); 100]);
    body["total_count"] = json!(101);
    first.body = serde_json::to_vec(&body).unwrap();
    first
        .headers
        .insert("link".into(), "<https://evil.invalid>; rel=next".into());
    let github = installation_client(recorded(vec![
        (Method::Get, api(&path(1)), first),
        (Method::Get, api(&path(2)), response("check-list")),
    ]));
    assert_eq!(
        Checks::list(&github, 1, "octocat/Hello-World", &"a".repeat(40), 123)
            .unwrap()
            .len(),
        101
    );
}

#[test]
fn list_exhaustion_is_transient_and_cannot_create_from_a_partial_read() {
    let github = installation_client(Unimock::new(
        HttpMock::send
            .each_call(matching!(_))
            .answers(&|_, _| {
                let mut record = response("check-list");
                let mut body: Value = serde_json::from_slice(&record.body).unwrap();
                body["check_runs"] = json!(vec![body["check_runs"][0].clone(); 100]);
                record.body = serde_json::to_vec(&body).unwrap();
                Ok(record)
            })
            .n_times(100),
    ));
    assert!(matches!(
        Checks::list(&github, 1, "octocat/Hello-World", &"a".repeat(40), 123),
        Err(Error::Internal(_))
    ));
}

#[test]
fn list_rejects_invalid_head_app_and_repository_before_network_access() {
    let github = client(Unimock::new(()));
    for (repository, head, app) in [
        ("octocat/Hello-World", "main".to_owned(), 123),
        ("octocat/Hello-World", "a".repeat(40), 0),
        ("octocat/Hello-World", format!("{}/x", "a".repeat(40)), 123),
        ("octocat/x?token=secret", "a".repeat(40), 123),
    ] {
        assert!(matches!(
            Checks::list(&github, 1, repository, &head, app),
            Err(Error::InvalidRequest)
        ));
    }
}
