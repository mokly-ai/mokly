//! Admission and close frames checked through the registered route.

use futures_util::SinkExt;
use mkc_domain::values::Role;
use mkc_store_interface::grant::Grant;
use mkc_store_interface::store::Callback;
use reqwest::{Client, Method};
use serde_json::{Value, json};
use tokio_tungstenite::connect_async;
use tungstenite::Message;
use uuid::Uuid;

use crate::response_validation::validate;

use super::fixtures::{
    CSRF, EXPIRED_TOKEN, MEMBER_TOKEN, MEMBERSHIP, ORIGIN, PRIVATE, PUBLIC, ROTATE_TOKEN, VISITOR,
    VISITOR_TOKEN,
};
use super::harness::{Harness, assert_notice, receive};

#[tokio::test]
async fn project_members_receive_notices_resync_and_shutdown() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    let mut member = app.open(PUBLIC, MEMBER_TOKEN).await;
    app.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_grant(&Grant {
                id: Uuid::from_u128(7).into(),
                project_id: PUBLIC,
                user_id: VISITOR,
                role: Role::Reviewer,
                version: 1,
            })
        }))
        .unwrap();
    let mut direct_grant = app.open(PUBLIC, VISITOR_TOKEN).await;

    app.notice(PUBLIC);
    assert_notice(&mut member).await;
    assert_notice(&mut direct_grant).await;
    app.relay.inject_gap();
    let frame = receive(&mut member).await;
    assert_eq!(
        serde_json::from_str::<Value>(frame.to_text().unwrap()).unwrap(),
        json!({"type": "resync"})
    );
    let gap = receive(&mut direct_grant).await;
    assert_eq!(
        serde_json::from_str::<Value>(gap.to_text().unwrap()).unwrap(),
        json!({"type": "resync"})
    );

    app.stop.cancel();
    assert_eq!(close_code(receive(&mut member).await), 1001);
    assert_eq!(close_code(receive(&mut direct_grant).await), 1001);
    (&mut app.finished).await.unwrap();
}

#[tokio::test]
async fn refusals_preserve_validation_origin_session_and_member_order() {
    let Some(app) = Harness::start() else {
        return;
    };
    let public = PUBLIC.to_string();
    let private = PRIVATE.to_string();
    let bad_origin = "https://unadmitted.example.com";
    let path = format!("/v1/live/projects/{public}");
    let response = Client::new()
        .get(format!("http://{}{path}", app.address))
        .header("origin", bad_origin)
        .header("x-request-id", "live-test")
        .send()
        .await
        .unwrap();
    let status = response.status().as_u16();
    assert_eq!(response.headers()["x-request-id"], "live-test");
    assert_refusal(
        &path,
        status,
        &response.bytes().await.unwrap(),
        400,
        "validation-failed",
    );

    let cases = [
        ("invalid", bad_origin, None, 400, "validation-failed"),
        (
            &public,
            bad_origin,
            Some(EXPIRED_TOKEN),
            403,
            "csrf-rejected",
        ),
        (&private, ORIGIN, None, 401, "unauthenticated"),
        (&public, ORIGIN, None, 401, "unauthenticated"),
        (&public, ORIGIN, Some("unknown"), 401, "unauthenticated"),
        (&public, ORIGIN, Some(EXPIRED_TOKEN), 401, "session-expired"),
        (&public, ORIGIN, Some(VISITOR_TOKEN), 404, "not-found"),
    ];
    for (project, origin, credential, expected_status, reason) in cases {
        let request = app.request(project, origin, credential);
        let path = request.uri().path().to_owned();
        let result = connect_async(request).await;
        let Err(tungstenite::Error::Http(response)) = result else {
            panic!("{project} {reason}: expected an HTTP refusal, got {result:?}");
        };
        assert_eq!(response.headers()["x-request-id"], "live-test");
        assert_refusal(
            &path,
            response.status().as_u16(),
            response.body().as_deref().unwrap(),
            expected_status,
            reason,
        );
    }
}

#[tokio::test]
async fn removing_the_workspace_membership_closes_a_public_project_socket() {
    let Some(app) = Harness::start() else {
        return;
    };
    let mut socket = app.open(PUBLIC, MEMBER_TOKEN).await;
    app.notice(PUBLIC);
    assert_notice(&mut socket).await;

    app.store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_member(MEMBERSHIP)
        }))
        .unwrap();
    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    app.clock.advance(5);
    assert_eq!(close_code(receive(&mut socket).await), 4403);
}

#[tokio::test]
async fn sign_out_and_rotation_close_sockets_using_the_original_sessions() {
    let Some(app) = Harness::start() else {
        return;
    };
    let mut sign_out = app.open(PUBLIC, MEMBER_TOKEN).await;
    let mut rotate = app.open(PUBLIC, ROTATE_TOKEN).await;
    app.notice(PUBLIC);
    assert_notice(&mut sign_out).await;
    assert_notice(&mut rotate).await;

    let client = Client::new();
    for (method, credential, status) in [
        (Method::DELETE, MEMBER_TOKEN, 204),
        (Method::POST, ROTATE_TOKEN, 200),
    ] {
        let response = client
            .request(method, format!("http://{}/v1/session", app.address))
            .header("origin", ORIGIN)
            .header("cookie", format!("mkc_session={credential}"))
            .header("x-csrf-token", CSRF)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), status);
    }
    app.clock.advance(25);
    assert_eq!(
        receive(&mut sign_out).await,
        Message::Ping(Default::default())
    );
    assert_eq!(
        receive(&mut rotate).await,
        Message::Ping(Default::default())
    );
    app.clock.advance(5);
    assert_eq!(close_code(receive(&mut sign_out).await), 4403);
    assert_eq!(close_code(receive(&mut rotate).await), 4403);
}

#[tokio::test]
async fn oversized_text_and_binary_close_with_1009() {
    let Some(app) = Harness::start() else {
        return;
    };
    for message in [
        Message::Text("é".repeat(2049).into()),
        Message::Binary(vec![0; 4097].into()),
    ] {
        let mut socket = app.open(PUBLIC, MEMBER_TOKEN).await;
        socket.send(message).await.unwrap();
        assert_eq!(close_code(receive(&mut socket).await), 1009);
    }
}

fn assert_refusal(path: &str, status: u16, body: &[u8], expected_status: u16, reason: &str) {
    assert_eq!(status, expected_status, "{path} {reason}");
    validate("GET", path, status, body);
    let body: Value = serde_json::from_slice(body).unwrap();
    assert_eq!(body["error"]["reason"], reason, "{path}");
    assert_eq!(body["error"]["request_id"], "live-test");
}

pub(super) fn close_code(message: Message) -> u16 {
    let Message::Close(Some(frame)) = message else {
        panic!("expected a close code, got {message:?}");
    };
    u16::from(frame.code)
}
