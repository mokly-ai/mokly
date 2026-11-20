//! Provider DTOs, request methods, payload encoding and pagination contracts.

use mkc_github_interface::checks::{Checks, Conclusion, Create, Output, Status, Update};
use mkc_github_interface::error::Error;
use mkc_github_interface::http::{HttpMock, Method};
use mkc_github_interface::pull_requests::{
    Comment, PullRequests, Review, ReviewEvent, Side, State,
};
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{api, client, installation_client, recorded, response};

#[test]
fn check_mutations_encode_status_output_and_recovery_key() {
    let github = installation_client(Unimock::new(
        HttpMock::send
            .some_call(matching!(_))
            .answers(&|_, request| {
                assert_eq!(request.method, Method::Post);
                assert_eq!(
                    request.endpoint,
                    api("/repos/octocat/Hello-World/check-runs")
                );
                let body: Value = serde_json::from_str(request.body.as_ref().unwrap()).unwrap();
                assert_eq!(body["external_id"], "publication-fixture");
                assert_eq!(body["conclusion"], "neutral");
                assert_eq!(body["status"], "completed");
                assert_eq!(body["output"]["summary"], "Three screens changed.");
                assert!(body["output"].get("text").is_none());
                Ok(response("check-create"))
            }),
    ));
    let update = Update {
        details_url: None,
        status: Status::Completed,
        conclusion: Some(Conclusion::Neutral),
        output: Some(Output {
            title: "Changes ready".into(),
            summary: "Three screens changed.".into(),
            text: None,
        }),
    };
    let input = Create {
        name: "Mokly".into(),
        head_sha: "a".repeat(40),
        details_url: "https://app.example.com/mokly/cloud".into(),
        external_id: "publication-fixture".into(),
        update,
    };
    assert_eq!(
        Checks::create(&github, 1, "octocat/Hello-World", &input)
            .unwrap()
            .id,
        4
    );
}

#[test]
fn checks_update_and_rerequest_use_distinct_rest_operations() {
    let github = installation_client(recorded(vec![
        (
            Method::Patch,
            api("/repos/octocat/Hello-World/check-runs/4"),
            response("check-update"),
        ),
        (
            Method::Post,
            api("/repos/octocat/Hello-World/check-runs/4/rerequest"),
            response("check-rerequest"),
        ),
    ]));
    assert_eq!(
        Checks::update(
            &github,
            1,
            "octocat/Hello-World",
            4,
            &Update {
                details_url: None,
                status: Status::Completed,
                conclusion: Some(Conclusion::Neutral),
                output: None
            }
        )
        .unwrap()
        .id,
        4
    );
    Checks::rerequest(&github, 1, "octocat/Hello-World", 4).unwrap();
}

#[test]
fn pull_request_reads_reviews_and_line_comments_preserve_provider_shapes() {
    let github = installation_client(recorded(vec![
        (
            Method::Get,
            api("/repos/octocat/Hello-World/pulls/42"),
            response("pull-request"),
        ),
        (
            Method::Get,
            api("/repos/octocat/Hello-World/pulls?state=open&per_page=100&page=1"),
            response("pull-requests"),
        ),
        (
            Method::Post,
            api("/repos/octocat/Hello-World/pulls/42/reviews"),
            response("review"),
        ),
        (
            Method::Post,
            api("/repos/octocat/Hello-World/pulls/42/comments"),
            response("comment"),
        ),
    ]));
    assert_eq!(
        PullRequests::get(&github, 1, "octocat/Hello-World", 42)
            .unwrap()
            .head
            .name,
        "feature/catalogue"
    );
    assert_eq!(
        PullRequests::list(&github, 1, "octocat/Hello-World", State::Open)
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        PullRequests::review(
            &github,
            1,
            "octocat/Hello-World",
            42,
            &Review {
                commit_id: "a".repeat(40),
                body: "Reviewed.".into(),
                event: ReviewEvent::Comment
            }
        )
        .unwrap()
        .id,
        80
    );
    assert_eq!(
        PullRequests::comment(
            &github,
            1,
            "octocat/Hello-World",
            42,
            &Comment {
                body: "Looks good.".into(),
                commit_id: "a".repeat(40),
                path: "mockup.tsx".into(),
                line: 1,
                side: Side::Right
            }
        )
        .unwrap()
        .id,
        90
    );
}

#[test]
fn invalid_check_transitions_and_path_injection_fail_before_network() {
    let github = client(Unimock::new(()));
    assert!(matches!(
        Checks::update(
            &github,
            1,
            "octocat/Hello-World",
            4,
            &Update {
                details_url: None,
                status: Status::Completed,
                conclusion: None,
                output: None
            }
        ),
        Err(Error::InvalidRequest)
    ));
    for repository in [
        "../users",
        "octocat/../secret",
        "octocat/x?token=secret",
        "https://evil.invalid/repo",
    ] {
        assert!(matches!(
            PullRequests::get(&github, 1, repository, 42),
            Err(Error::InvalidRequest)
        ));
    }
}
