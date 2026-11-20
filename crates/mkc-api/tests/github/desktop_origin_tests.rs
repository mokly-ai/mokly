//! GitHub request admission and cookie attributes through the real configured API.

use mkc_domain::app_paths;
use mkc_domain::client_origins::DESKTOP_ORIGIN;
use reqwest::Method;
use serde_json::json;
use url::Url;

use super::harness::{APP, Harness, json as response_json};

#[test]
fn github_admits_the_desktop_only_when_enabled_and_keeps_public_redirects() {
    for desktop_client in [false, true] {
        let Some(mut app) = Harness::start_with_desktop_client(desktop_client) else {
            return;
        };
        for origin in [APP, DESKTOP_ORIGIN, "https://third.example.com"] {
            let admitted = origin == APP || desktop_client && origin == DESKTOP_ORIGIN;
            let response = app
                .request_from(Method::POST, "/v1/auth/github", origin)
                .json(&json!({}))
                .send()
                .unwrap();
            if !admitted {
                assert!(
                    response
                        .headers()
                        .get("access-control-allow-origin")
                        .is_none()
                );
                let error = response_json(response, 403);
                assert_eq!(error["error"]["reason"], "csrf-rejected");
                let error = response_json(
                    app.request_from(Method::POST, "/v1/auth/github/callback", origin)
                        .json(&json!({"code":"code", "state":"state", "codeVerifier":"verifier"}))
                        .send()
                        .unwrap(),
                    403,
                );
                assert_eq!(error["error"]["reason"], "csrf-rejected");
                continue;
            }
            assert_eq!(response.headers()["access-control-allow-origin"], origin);
            let start = response_json(response, 200);
            let authorize = Url::parse(start["authorizeUrl"].as_str().unwrap()).unwrap();
            let redirect = authorize
                .query_pairs()
                .find(|(key, _)| key == "redirect_uri")
                .unwrap()
                .1;
            assert_eq!(
                redirect,
                app_paths::on_origin(APP, app_paths::GITHUB_CALLBACK)
            );
            let response = app.request_from(Method::POST, "/v1/auth/github/callback", origin)
                .json(&json!({"code":"desktop-code", "state":start["state"], "codeVerifier":start["codeVerifier"]}))
                .send().unwrap();
            assert_eq!(response.headers()["access-control-allow-origin"], origin);
            let same_site = if origin == DESKTOP_ORIGIN {
                "None"
            } else {
                "Lax"
            };
            let cookie = response.headers()["set-cookie"].to_str().unwrap();
            assert!(
                cookie.ends_with(&format!(
                    "Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age=2592000"
                )),
                "{cookie}"
            );
            let result = app.session(response);
            assert_eq!(result["returnTo"], app_paths::DASHBOARD);
            let response = app
                .request_from(Method::DELETE, "/v1/session", origin)
                .send()
                .unwrap();
            assert_eq!(response.status(), 204);
            assert_eq!(
                response.headers()["set-cookie"],
                format!("mkc_session=; Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age=0")
            );
        }
    }
}
