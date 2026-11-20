//! The table answers only the recorded requests, with the configured credentials.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

use crate::error::Error;
use crate::mode::Mode;
use crate::received::Received;
use crate::recording::Recorded;
use crate::routes::{RECORDED_REPOSITORY_ID, route};

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

fn exchange(mode: &Mode, code_verifier: &str) -> Received {
    Received {
        method: "POST".into(),
        path: "/login/oauth/access_token".into(),
        body: json!({
            "client_id": mode.client_id,
            "client_secret": mode.client_secret,
            "redirect_uri": mode.redirect_uri(),
            "code_verifier": code_verifier,
        })
        .to_string(),
        accept: Some("application/json".into()),
        api_version: Some("2022-11-28".into()),
        user_agent: Some("Mokly-Cloud-GitHub-App".into()),
        authorization: None,
    }
}

#[test]
fn every_recording_decodes_into_an_independent_answer() {
    for recorded in [
        Recorded::Installation,
        Recorded::OrganizationInstallation,
        Recorded::OrganizationRepositories,
        Recorded::OrganizationMembership,
        Recorded::Repositories,
        Recorded::InstallationToken,
        Recorded::RepositoryToken,
        Recorded::OAuthToken,
        Recorded::User,
        Recorded::Emails,
        Recorded::UserInstallations,
        Recorded::PullRequest,
        Recorded::CheckList,
        Recorded::CheckCreate,
        Recorded::CheckUpdate,
        Recorded::Branch,
        Recorded::NotFound,
        Recorded::Unavailable,
    ] {
        assert!(recorded.response().is_ok(), "{recorded:?}");
    }
}

#[test]
fn a_request_without_the_provider_headers_is_refused() {
    let mut mode = Mode::default();
    for (name, broken) in [
        (
            "X-GitHub-Api-Version",
            Received {
                api_version: None,
                ..read("/user")
            },
        ),
        (
            "User-Agent",
            Received {
                user_agent: Some("curl/8".into()),
                ..read("/user")
            },
        ),
        (
            "Accept",
            Received {
                accept: Some("*/*".into()),
                ..read("/user")
            },
        ),
        (
            "Authorization",
            Received {
                authorization: None,
                ..read("/user")
            },
        ),
    ] {
        let error = route(&broken, &mut mode).unwrap_err();
        assert!(
            matches!(error, Error::Header { name: found } if found == name),
            "{error:?}"
        );
        assert_eq!(error.status(), 400);
    }
}

#[test]
fn an_unknown_target_or_method_is_reported_as_unrecorded() {
    let mut mode = Mode::default();
    let unknown = route(&read("/rate_limit"), &mut mode).unwrap_err();
    assert!(matches!(unknown, Error::Unrecorded { .. }));
    assert_eq!(unknown.status(), 501);
    let wrong_method = Received {
        method: "DELETE".into(),
        ..read("/user")
    };
    assert!(matches!(
        route(&wrong_method, &mut mode).unwrap_err(),
        Error::Unrecorded { .. }
    ));
}

#[test]
fn the_token_exchange_must_present_the_configured_app_credentials() {
    let mut mode = Mode {
        app_origin: "http://localhost:8081".into(),
        client_id: "Iv1.browser".into(),
        client_secret: "browser-secret".into(),
        ..Mode::default()
    };
    let accepted = exchange(&mode, &"a".repeat(64));
    assert!(route(&accepted, &mut mode).is_ok());
    assert_eq!(mode.oauth_requests, 1);
    let short = exchange(&mode, "a");
    assert!(matches!(
        route(&short, &mut mode).unwrap_err(),
        Error::OAuth {
            name: "code_verifier"
        }
    ));
    let default = exchange(&Mode::default(), &"a".repeat(64));
    assert!(matches!(
        route(&default, &mut mode).unwrap_err(),
        Error::OAuth { name: "client_id" }
    ));
}

#[test]
fn scenario_state_shapes_the_installation_and_repository_answers() {
    let mut mode = Mode {
        repository_name: Some("mokly-ai/mokly".into()),
        repository_id: Some(77),
        private: true,
        default_branch: Some("current-default".into()),
        ..Mode::default()
    };
    let repositories = route(
        &read("/installation/repositories?per_page=100&page=1"),
        &mut mode,
    )
    .unwrap();
    assert_eq!(
        repositories.body["repositories"][0]["full_name"],
        "mokly-ai/mokly"
    );
    assert_eq!(repositories.body["repositories"][0]["id"], 77);
    assert_eq!(repositories.body["repositories"][0]["private"], true);
    assert_eq!(
        repositories.body["repositories"][0]["default_branch"],
        "current-default"
    );
    assert_eq!(mode.repository_requests, 1);
    assert!(repositories.headers.contains_key("x-ratelimit-reset"));

    mode.uninstalled = true;
    let absent = route(&read("/app/installations/1"), &mut mode).unwrap();
    assert_eq!(absent.status, 404);
    mode.uninstalled = false;
    mode.suspended = true;
    let suspended = route(&read("/app/installations/1"), &mut mode).unwrap();
    assert!(suspended.body["suspended_at"].is_string());
    assert_eq!(
        suspended.body["html_url"],
        "https://github.com/settings/installations/1"
    );
}

#[test]
fn a_renamed_repository_redirects_branch_reads_to_its_current_target() {
    let mut mode = Mode {
        repository_name: Some("octocat/Renamed".into()),
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
        "/repos/octocat/Renamed/branches/feature%2Fcatalogue"
    );
    let current = route(
        &read("/repos/octocat/Renamed/branches/feature%2Fcatalogue"),
        &mut mode,
    )
    .unwrap();
    assert_eq!(current.status, 200);
    assert_eq!(mode.branch_paths.len(), 2);
}

fn mint(body: &str) -> Received {
    Received {
        method: "POST".into(),
        body: body.into(),
        ..read("/app/installations/1/access_tokens")
    }
}

#[test]
fn the_recorded_repository_id_is_the_first_installed_repository() {
    let repositories = Recorded::Repositories.response().unwrap();
    assert_eq!(
        repositories.body["repositories"][0]["id"],
        RECORDED_REPOSITORY_ID
    );
}

#[test]
fn a_scoped_token_reads_only_the_installed_repository_contents() {
    let mut mode = Mode::default();
    let whole = route(&mint("{}"), &mut mode).unwrap();
    assert!(whole.body["expires_at"].is_string());
    let scoped = route(
        &mint(
            &json!({ "repository_ids": [RECORDED_REPOSITORY_ID], "permissions": { "contents": "read" } })
                .to_string(),
        ),
        &mut mode,
    )
    .unwrap();
    assert!(scoped.body["expires_at"].is_string());
    assert_eq!((mode.token_requests, mode.scoped_token_requests), (2, 1));
    let widened = mint(
        &json!({ "repository_ids": [RECORDED_REPOSITORY_ID], "permissions": { "contents": "write" } })
            .to_string(),
    );
    assert!(matches!(
        route(&widened, &mut mode).unwrap_err(),
        Error::Field {
            name: "repository_ids"
        }
    ));
}
