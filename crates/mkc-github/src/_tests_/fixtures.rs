//! Sanitized recorded responses and strict request-script helpers.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use mkc_github_interface::credentials::{AppJwt, AppJwtMock, Secret, TokensMock};
use mkc_github_interface::http::{Endpoint, HttpMock, Method, Request, Response};
use serde::Deserialize;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use crate::client::{GitHub, OAuthSettings};

#[derive(Deserialize)]
struct Recorded {
    status: u16,
    headers: BTreeMap<String, String>,
    body: Value,
}

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

pub(super) fn response(name: &str) -> Response {
    let source = match name {
        "installation" => include_str!("../../fixtures/installation.json"),
        "repositories" => include_str!("../../fixtures/repositories.json"),
        "installation-token" => include_str!("../../fixtures/installation-token.json"),
        "repository-token" => include_str!("../../fixtures/repository-token.json"),
        "user" => include_str!("../../fixtures/user.json"),
        "emails" => include_str!("../../fixtures/emails.json"),
        "user-installations" => include_str!("../../fixtures/user-installations.json"),
        "membership" => include_str!("../../fixtures/membership.json"),
        "oauth-token" => include_str!("../../fixtures/oauth-token.json"),
        "oauth-invalid" => include_str!("../../fixtures/oauth-invalid.json"),
        "pull-request" => include_str!("../../fixtures/pull-request.json"),
        "pull-requests" => include_str!("../../fixtures/pull-requests.json"),
        "check-list" => include_str!("../../fixtures/check-list.json"),
        "branch" => include_str!("../../fixtures/branch.json"),
        "check-create" => include_str!("../../fixtures/check-create.json"),
        "check-update" => include_str!("../../fixtures/check-update.json"),
        "check-rerequest" => include_str!("../../fixtures/check-rerequest.json"),
        "review" => include_str!("../../fixtures/review.json"),
        "comment" => include_str!("../../fixtures/comment.json"),
        "secondary-limit" => include_str!("../../fixtures/secondary-limit.json"),
        "primary-limit" => include_str!("../../fixtures/primary-limit.json"),
        "forbidden" => include_str!("../../fixtures/forbidden.json"),
        "unauthorized" => include_str!("../../fixtures/unauthorized.json"),
        "not-found" => include_str!("../../fixtures/not-found.json"),
        "unavailable" => include_str!("../../fixtures/unavailable.json"),
        _ => panic!("unknown recording: {name}"),
    };
    let record: Recorded = serde_json::from_str(source).unwrap();
    Response {
        status: record.status,
        headers: record.headers,
        body: serde_json::to_vec(&record.body).unwrap(),
    }
}

pub(super) fn client(http: Unimock) -> GitHub {
    GitHub {
        http: Arc::new(http),
        tokens: Arc::new(Unimock::new(())),
        jwt: Arc::new(Unimock::new(())),
        oauth: OAuthSettings {
            client_id: "Iv1.fixture".to_owned(),
            client_secret: Secret::new("client-secret".to_owned()),
            redirect_uri: "https://app.example.com/auth/github/callback".to_owned(),
        },
    }
}

pub(super) fn installation_client(http: Unimock) -> GitHub {
    let mut github = client(http);
    github.tokens = Arc::new(Unimock::new(
        TokensMock::get
            .each_call(matching!(1))
            .answers(&|_, _| Ok(Secret::new("installation-token".to_owned()))),
    ));
    github
}

pub(super) fn app_jwt() -> Arc<dyn AppJwt> {
    Arc::new(Unimock::new(
        AppJwtMock::issue
            .each_call(matching!())
            .answers(&|_| Ok(Secret::new("app-jwt".to_owned()))),
    ))
}

pub(super) fn recorded(steps: Vec<(Method, Endpoint, Response)>) -> Unimock {
    let count = steps.len();
    let steps = Mutex::new(VecDeque::from(steps));
    Unimock::new(
        HttpMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: &Request| {
                let (method, endpoint, response) = steps
                    .lock()
                    .unwrap()
                    .pop_front()
                    .expect("extra provider request");
                assert_eq!(request.method, method);
                assert_eq!(request.endpoint, endpoint);
                if endpoint != Endpoint::OAuthToken {
                    assert!(request.bearer.is_some());
                }
                Ok(response)
            }))
            .n_times(count),
    )
}

pub(super) fn api(path: &str) -> Endpoint {
    Endpoint::Api(path.to_owned())
}
