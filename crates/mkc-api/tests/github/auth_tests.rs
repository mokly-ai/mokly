//! Authenticated connection and installation when GitHub uses a different primary email.

use reqwest::Method;
use serde_json::json;

use super::harness::{Harness, json as response_json};

#[test]
fn connect_and_install_keep_the_session_user_when_verified_github_email_differs() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    assert_eq!(
        app.request(Method::DELETE, "/v1/github/connection")
            .send()
            .unwrap()
            .status(),
        204
    );
    app.github.mode.lock().unwrap().primary_email = Some("personal@example.com".into());
    let start = response_json(
        app.request(Method::POST, "/v1/github/connection")
            .json(&json!({"returnTo":"/dashboard?settings=account"}))
            .send()
            .unwrap(),
        200,
    );
    let previous = app.cookie.clone();
    let response = app.request(Method::POST, "/v1/auth/github/callback")
        .json(&json!({"code":"connect-personal","state":start["state"],"codeVerifier":start["codeVerifier"]}))
        .send().unwrap();
    let connected = app.session(response);
    assert_eq!(connected["session"]["user"]["id"], app.user.to_string());
    assert_eq!(connected["session"]["user"]["email"], "octocat@example.com");
    assert_ne!(app.cookie, previous);
    assert_eq!(
        app.request(Method::DELETE, "/v1/github/connection")
            .send()
            .unwrap()
            .status(),
        204
    );
    app.install_project();
    app.queries(&mut |queries| {
        let linked = queries.user_github_identity(app.user)?.unwrap();
        assert_eq!(linked.github_user_id, 1);
        assert_eq!(
            queries.user(app.user)?.unwrap().email,
            "octocat@example.com"
        );
        assert!(queries.find_user("personal@example.com")?.is_none());
        Ok(())
    });
}
