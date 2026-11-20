//! The second account has its own identity, token, selection and administrator proof.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

use crate::mode::Mode;
use crate::received::Received;
use crate::routes::route;

fn read(path: &str) -> Received {
    Received {
        method: "GET".into(),
        path: path.into(),
        body: String::new(),
        accept: Some("application/vnd.github+json".into()),
        api_version: Some("2022-11-28".into()),
        user_agent: Some("Mokly-Cloud-GitHub-App".into()),
        authorization: Some("Bearer user-token".into()),
    }
}

#[test]
fn second_installation_tokens_select_only_the_organization_repository() {
    let mut mode = Mode {
        second_installation: true,
        ..Mode::default()
    };
    let installations = route(&read("/user/installations?per_page=100&page=1"), &mut mode).unwrap();
    assert_eq!(installations.body["total_count"], 2);
    assert_eq!(
        installations.body["installations"][1]["account"]["type"],
        "Organization"
    );
    let membership = route(&read("/user/memberships/orgs/fixture-org"), &mut mode).unwrap();
    assert_eq!(membership.body["role"], "admin");
    assert_eq!(membership.body["state"], "active");
    let token = route(
        &Received {
            method: "POST".into(),
            body: "{}".into(),
            ..read("/app/installations/2/access_tokens")
        },
        &mut mode,
    )
    .unwrap();
    let repositories = route(
        &Received {
            authorization: Some(format!("Bearer {}", token.body["token"].as_str().unwrap())),
            ..read("/installation/repositories?per_page=100&page=1")
        },
        &mut mode,
    )
    .unwrap();
    assert_eq!(repositories.body["repositories"][0]["id"], 1296270);
    assert_eq!(
        repositories.body["repositories"][0]["full_name"],
        "fixture-org/Catalogue"
    );
    mode.second_suspended = true;
    let suspended = route(&read("/app/installations/2"), &mut mode).unwrap();
    assert!(suspended.body["suspended_at"].is_string());
    let personal = route(&read("/app/installations/1"), &mut mode).unwrap();
    assert!(personal.body["suspended_at"].is_null());
    assert_eq!(personal.body["id"], json!(1));
}
