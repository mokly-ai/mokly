//! Desktop grants exercise real Origin, CSRF, cookie, CORS and cache policy.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use axum::body::to_bytes;
use chrono::Duration;
use mkc_auth::runtime::hash;
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::DESKTOP_ORIGIN;
use mkc_store_interface::desktop_grant::{DesktopGrant, DesktopGrantsMock};
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::user::UsersMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::contract::response_capture::checked;

#[path = "desktop_grant_api/support.rs"]
mod support;

use support::{
    APP, CALLBACK, CHALLENGE, GRANT, ISSUE, VERIFIER, identity, now, reads, request, router,
};

#[tokio::test]
async fn desktop_grant_issue_requires_session_origin_and_csrf_before_body_shape() {
    for (origin, csrf, cookie, status, reason) in [
        (None, None, false, 401, "unauthenticated"),
        (None, Some("csrf"), true, 403, "csrf-rejected"),
        (
            Some("https://third.example.com"),
            Some("csrf"),
            true,
            403,
            "csrf-rejected",
        ),
        (Some(APP), None, true, 403, "csrf-rejected"),
        (Some(APP), Some("wrong"), true, 403, "csrf-rejected"),
        (Some(APP), Some("csrf"), true, 400, "validation-failed"),
    ] {
        let read = cookie.then(reads);
        let api = router(read, None, false, true, TrustedProxies::default());
        let response = checked(api, request(ISSUE, "{", origin, csrf, cookie)).await;
        assert_eq!(response.status(), status);
        let body: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(body["error"]["reason"], reason);
    }
}

#[tokio::test]
async fn desktop_grant_callback_checks_origin_before_body_and_rejects_bad_shapes_without_admission()
{
    for (origin, body, reason) in [
        (None, "{", "csrf-rejected"),
        (Some("null"), "{", "csrf-rejected"),
        (Some(APP), "{", "validation-failed"),
        (Some(APP), "{}", "validation-failed"),
        (
            Some(APP),
            "{\"grant\":1,\"verifier\":\"bad\"}",
            "validation-failed",
        ),
        (
            Some(APP),
            "{\"grant\":\"bad\",\"verifier\":\"bad\",\"extra\":true}",
            "validation-failed",
        ),
    ] {
        let api = router(None, None, false, true, TrustedProxies::default());
        let response = checked(api, request(CALLBACK, body, origin, None, true)).await;
        let body: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(body["error"]["reason"], reason);
    }
}

#[tokio::test]
async fn desktop_grant_issue_returns_a_nostore_grant_without_a_cookie() {
    let write = Unimock::new((
        RateLimitsMock::rate_limit.some_call(matching!((key,) if key == &hash("desktop-grant-issue:10.0.0.1"))).returns(Ok(None)),
        RateLimitsMock::insert_rate_limit.some_call(matching!(_)).returns(Ok(())),
        DesktopGrantsMock::insert_desktop_grant.some_call(matching!((record,) if record.challenge == CHALLENGE && record.return_to == "/acme/project?branch=topic%2Fwork" && record.token_hash == hash(&"c".repeat(64)))).returns(Ok(())),
    ));
    let api = router(
        Some(reads()),
        Some(write),
        true,
        true,
        TrustedProxies::default(),
    );
    let body =
        json!({"challenge": CHALLENGE, "returnTo": "/acme/project?branch=topic%2Fwork#fragment"})
            .to_string();
    let response = checked(api, request(ISSUE, &body, Some(APP), Some("csrf"), true)).await;
    assert_eq!(response.status(), 201);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(!response.headers().contains_key("set-cookie"));
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(
        body,
        json!({"grant": "c".repeat(64), "expiresAt": "2026-11-06T12:05:00Z"})
    );
}

#[tokio::test]
async fn desktop_grant_callback_uses_origin_for_cookie_and_cors_and_inherits_max_age() {
    for (origin, same_site) in [(APP, "Lax"), (DESKTOP_ORIGIN, "None")] {
        let write = Unimock::new((
            RateLimitsMock::rate_limit
                .some_call(matching!(_))
                .returns(Ok(None)),
            RateLimitsMock::insert_rate_limit
                .some_call(matching!(_))
                .returns(Ok(())),
            DesktopGrantsMock::desktop_grant
                .some_call(matching!((key,) if key == &hash(GRANT)))
                .returns(Ok(Some(DesktopGrant {
                    token_hash: hash(GRANT),
                    challenge: CHALLENGE.into(),
                    user_id: identity().user.id,
                    return_to: "/acme/project?branch=topic%2Fwork".into(),
                    expires_at: now() + Duration::minutes(5),
                    session_expires_at: now() + Duration::hours(3),
                    used_at: None,
                }))),
            DesktopGrantsMock::consume_desktop_grant
                .some_call(matching!(_, _))
                .returns(Ok(true)),
            UsersMock::user
                .some_call(matching!(_))
                .returns(Ok(Some(identity().user))),
            SessionsMock::delete_session
                .some_call(matching!((key,) if key == &hash("old")))
                .returns(Ok(())),
            SessionsMock::insert_session
                .some_call(matching!(_))
                .returns(Ok(())),
        ));
        let api = router(None, Some(write), true, true, TrustedProxies::default());
        let body = json!({"grant": GRANT, "verifier": VERIFIER}).to_string();
        let response = checked(api, request(CALLBACK, &body, Some(origin), None, true)).await;
        assert_eq!(response.status(), 200);
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert_eq!(response.headers()["access-control-allow-origin"], origin);
        assert_eq!(
            response.headers()["access-control-allow-credentials"],
            "true"
        );
        assert!(response.headers().get_all("vary").iter().any(|v| {
            v.to_str()
                .unwrap()
                .split(',')
                .any(|part| part.trim().eq_ignore_ascii_case("origin"))
        }));
        assert_eq!(
            response.headers()["set-cookie"],
            format!(
                "mkc_session={}; Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age=10800",
                "c".repeat(64)
            )
        );
        let body: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(body["returnTo"], "/acme/project?branch=topic%2Fwork");
        assert_eq!(
            body["session"]["user"]["id"],
            identity().user.id.to_string()
        );
    }
}

#[tokio::test]
async fn desktop_grant_callback_refuses_desktop_origin_when_disabled() {
    let api = router(None, None, false, false, TrustedProxies::default());
    let response = checked(
        api,
        request(CALLBACK, "{", Some(DESKTOP_ORIGIN), None, false),
    )
    .await;
    assert_eq!(response.status(), 403);
    assert!(
        !response
            .headers()
            .contains_key("access-control-allow-origin")
    );
}

#[tokio::test]
async fn desktop_grant_admission_uses_the_trusted_peer_and_returns_retry_after() {
    for (hops, peer) in [(0, "10.0.0.1"), (1, "192.0.2.5")] {
        for path in [ISSUE, CALLBACK] {
            let endpoint = if path == ISSUE { "issue" } else { "exchange" };
            let expected = hash(&format!("desktop-grant-{endpoint}:{peer}"));
            let write = Unimock::new(
                RateLimitsMock::rate_limit
                    .some_call(matching!(_))
                    .answers_arc(Arc::new(move |_, key| {
                        assert_eq!(key, expected);
                        Ok(Some(RateLimit {
                            key: key.to_owned(),
                            count: 20,
                            resets_at: now() + Duration::seconds(19),
                        }))
                    })),
            );
            let read = (path == ISSUE).then(reads);
            let api = router(
                read,
                Some(write),
                false,
                true,
                TrustedProxies {
                    hops,
                    networks: vec!["10.0.0.0/8".parse().unwrap()],
                },
            );
            let body = if path == ISSUE {
                json!({"challenge":"bad"})
            } else {
                json!({"grant":"bad","verifier":"bad"})
            };
            let mut request = request(path, &body.to_string(), Some(APP), Some("csrf"), true);
            request
                .headers_mut()
                .insert("x-forwarded-for", "192.0.2.5".parse().unwrap());
            let response = checked(api, request).await;
            assert_eq!(response.status(), 429);
            assert_eq!(response.headers()["retry-after"], "19");
        }
    }
}
