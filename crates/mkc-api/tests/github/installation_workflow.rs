//! Complete real installation flows and candidate refreshes through public routes.

use mkc_auth::runtime::hash;
use reqwest::Method;
use serde_json::{Value, json};

use super::harness;
use super::harness::Harness;

pub(super) fn start(app: &Harness, workspace: &Value, id: i64, candidate: bool) -> Value {
    let mut input = json!({"workspaceId":workspace["id"],"returnTo":"/install"});
    if candidate {
        input["installationId"] = json!(id);
    }
    let flow = harness::json(
        app.request(Method::POST, "/v1/github/installations")
            .json(&input)
            .send()
            .unwrap(),
        200,
    );
    app.queries(&mut |queries| {
        let stored = queries
            .github_oauth_flow(&hash(flow["state"].as_str().unwrap()))
            .unwrap()
            .unwrap();
        assert_eq!(stored.installation_id, candidate.then_some(id));
    });
    if candidate {
        assert!(
            flow["authorizeUrl"]
                .as_str()
                .unwrap()
                .contains("/login/oauth/authorize?")
        );
    } else {
        assert!(
            flow["authorizeUrl"]
                .as_str()
                .unwrap()
                .contains("/installations/new?")
        );
        harness::json(
            app.request(Method::POST, "/v1/github/installations/callback")
                .json(&json!({
                    "installationId":id,"state":flow["state"],"codeVerifier":flow["codeVerifier"]
                }))
                .send()
                .unwrap(),
            200,
        );
    }
    flow
}

pub(super) fn finish(app: &mut Harness, flow: &Value, status: u16) -> Value {
    let response = app
        .request(Method::POST, "/v1/auth/github/callback")
        .json(&json!({
            "code":"installation-proof","state":flow["state"],"codeVerifier":flow["codeVerifier"]
        }))
        .send()
        .unwrap();
    if status == 200 {
        app.session(response)
    } else {
        harness::json(response, status)
    }
}

pub(super) fn connect(app: &mut Harness, workspace: &Value, id: i64, candidate: bool) {
    let flow = start(app, workspace, id, candidate);
    let session = finish(app, &flow, 200);
    assert_eq!(session["returnTo"], "/install");
}

pub(super) fn list(app: &Harness, workspace: &Value) -> Value {
    harness::json(
        app.request(
            Method::GET,
            &format!(
                "/v1/github/installations?workspaceId={}",
                workspace["id"].as_str().unwrap()
            ),
        )
        .send()
        .unwrap(),
        200,
    )
}
