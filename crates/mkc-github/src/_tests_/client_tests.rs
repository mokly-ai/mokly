//! Provider DTOs, request methods, payload encoding and pagination contracts.

use mkc_github_interface::credentials::Secret;
use mkc_github_interface::error::Error;
use mkc_github_interface::http::{Endpoint, HttpMock, Method};
use mkc_github_interface::identity::{Identities, MembershipRole, OAuthCode};
use mkc_github_interface::repositories::{AccountKind, Repositories};
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{api, app_jwt, client, installation_client, recorded, response};

#[test]
fn repositories_installations_and_slash_branches_use_correct_auth_and_paths() {
    let mut github = installation_client(recorded(vec![
        (
            Method::Get,
            api("/app/installations/1"),
            response("installation"),
        ),
        (
            Method::Get,
            api("/installation/repositories?per_page=100&page=1"),
            response("repositories"),
        ),
        (
            Method::Get,
            api("/repos/octocat/Hello-World/branches/feature%2Fcatalogue"),
            response("branch"),
        ),
    ]));
    github.jwt = app_jwt();
    assert_eq!(Repositories::installation(&github, 1).unwrap().app_id, 123);
    assert_eq!(
        Repositories::repositories(&github, 1).unwrap()[0].default_branch,
        "master"
    );
    assert_eq!(
        Repositories::branch(&github, 1, "octocat/Hello-World", "feature/catalogue")
            .unwrap()
            .commit
            .sha,
        "a".repeat(40)
    );
}

#[test]
fn oauth_exchange_sends_pkce_and_does_not_request_scopes() {
    let github = client(Unimock::new(HttpMock::send.some_call(matching!(_)).answers(&|_, request| {
        assert_eq!(request.endpoint, Endpoint::OAuthToken);
        assert!(request.bearer.is_none());
        let body: Value = serde_json::from_str(request.body.as_ref().unwrap()).unwrap();
        assert_eq!(body, json!({"client_id":"Iv1.fixture","client_secret":"client-secret","code":"code","code_verifier":"verifier","redirect_uri":"https://app.example.com/auth/github/callback"}));
        Ok(response("oauth-token"))
    })));
    let token = Identities::exchange(
        &github,
        &OAuthCode {
            code: "code".into(),
            verifier: "verifier".into(),
        },
    )
    .unwrap();
    assert_eq!(token.expose(), "ghu_sanitized_user_fixture");
    assert!(!format!("{token:?}").contains("ghu_"));
}

#[test]
fn identity_evidence_comes_from_user_authenticated_endpoints() {
    let github = client(recorded(vec![
        (Method::Get, api("/user"), response("user")),
        (
            Method::Get,
            api("/user/emails?per_page=100&page=1"),
            response("emails"),
        ),
        (
            Method::Get,
            api("/user/installations?per_page=100&page=1"),
            response("user-installations"),
        ),
        (
            Method::Get,
            api("/user/memberships/orgs/octo-org"),
            response("membership"),
        ),
    ]));
    let token = Secret::new("user-token".into());
    assert_eq!(Identities::user(&github, &token).unwrap().id, 1);
    let emails = Identities::emails(&github, &token).unwrap();
    assert!(emails[0].primary && emails[0].verified);
    assert_eq!(Identities::installations(&github, &token).unwrap()[0].id, 1);
    assert_eq!(
        Identities::membership(&github, &token, "octo-org")
            .unwrap()
            .role,
        MembershipRole::Admin
    );
}

#[test]
fn invalid_oauth_code_is_typed_even_on_http_200() {
    let github = client(recorded(vec![(
        Method::Post,
        Endpoint::OAuthToken,
        response("oauth-invalid"),
    )]));
    assert!(matches!(
        Identities::exchange(
            &github,
            &OAuthCode {
                code: "used".into(),
                verifier: "verifier".into()
            }
        ),
        Err(Error::InvalidCode)
    ));
}

#[test]
fn repository_pagination_and_unknown_response_fields_are_supported() {
    let mut first = response("repositories");
    let value: Value = serde_json::from_slice(&first.body).unwrap();
    first.body = serde_json::to_vec(&json!({"repositories":vec![value["repositories"][0].clone();100],"total_count":101,"future_field":true})).unwrap();
    let github = installation_client(recorded(vec![
        (
            Method::Get,
            api("/installation/repositories?per_page=100&page=1"),
            first,
        ),
        (
            Method::Get,
            api("/installation/repositories?per_page=100&page=2"),
            response("repositories"),
        ),
    ]));
    assert_eq!(Repositories::repositories(&github, 1).unwrap().len(), 101);
}

#[test]
fn enterprise_installation_owner_decodes_at_the_provider_boundary() {
    let mut response = response("installation");
    let mut body: Value = serde_json::from_slice(&response.body).unwrap();
    body["account"]["type"] = json!("Enterprise");
    body["account"]["login"] = json!("enterprise-owner");
    response.body = serde_json::to_vec(&body).unwrap();
    let mut github = client(recorded(vec![(
        Method::Get,
        api("/app/installations/1"),
        response,
    )]));
    github.jwt = app_jwt();
    let installation = Repositories::installation(&github, 1).unwrap();
    assert_eq!(installation.account.login, "enterprise-owner");
    assert_eq!(installation.account.kind, AccountKind::Enterprise);
}
