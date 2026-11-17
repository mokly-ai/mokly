//! Authentication transports preserve validated return destinations exactly.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::{Body, to_bytes};
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode, header};
use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{RuntimeMock, hash};
use mkc_auth::service::AuthService;
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_domain::ids::UserId;
use mkc_email_interface::mail::MailerMock;
use mkc_store_interface::magic_link::{MagicLink, MagicLinksMock};
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::{User, UsersMock};
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::contract::response_capture::checked;
use crate::dispatch::ApiDispatcher;
use crate::platform::service::PlatformSessionMock;
use crate::router::{RouterBuilder, RouterFactory};
use crate::views::account::{SessionView, UserView};

const APP_ORIGIN: &str = "https://app.example.com";
const RETURN_TO: &str = "/mokly/cloud?selection=one%26two&tag=alpha%2Bbeta&note=release%23one&branch=équipe/東京&view=changes&view=browse";

#[tokio::test]
async fn magic_link_issue_and_exchange_preserve_the_exact_return_destination() {
    let current_time = now();
    let token = "a".repeat(64);
    let credential = "b".repeat(64);
    let user = user(current_time);
    let queries = Unimock::new((
        RateLimitsMock::rate_limit
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
        RateLimitsMock::insert_rate_limit
            .each_call(matching!(_))
            .answers(&|_, rate: &RateLimit| {
                assert_eq!(rate.count, 1);
                Ok(())
            }),
        MagicLinksMock::insert_magic_link
            .next_call(matching!((link,) if link.return_to == RETURN_TO && link.email == "person@example.com" && link.token_hash == hash(&"a".repeat(64))))
            .returns(Ok(())),
        MagicLinksMock::magic_link
            .next_call(matching!(_))
            .returns(Ok(Some(MagicLink {
                token_hash: hash(&token),
                email: user.email.clone(),
                return_to: RETURN_TO.into(),
                expires_at: current_time + Duration::minutes(15),
                used_at: None,
            }))),
        UsersMock::find_user
            .next_call(matching!("person@example.com"))
            .returns(Ok(Some(user.clone()))),
        MagicLinksMock::save_magic_link
            .next_call(matching!((link,) if link.used_at == Some(now()) && link.return_to == RETURN_TO))
            .returns(Ok(())),
        SessionsMock::insert_session
            .next_call(matching!((session,) if session.user_id == UserId(Uuid::from_u128(7)) && session.token_hash == hash(&"b".repeat(64)) && session.csrf_token == "csrf"))
            .returns(Ok(())),
    ));
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            })),
    );
    let runtime = Unimock::new((
        RuntimeMock::now
            .each_call(matching!())
            .returns(current_time),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok(token.clone())),
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(8)),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok(credential.clone())),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("csrf".into())),
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(9)),
    ));
    let auth = AuthService {
        store: Arc::new(store),
        mailer: Arc::new(Unimock::new(
            MailerMock::send.next_call(matching!(_)).returns(Ok(())),
        )),
        runtime: Arc::new(runtime),
        origins: AdmittedOrigins::new(APP_ORIGIN.into(), false),
        preview_sign_in: None,
    };
    let platform = Unimock::new(PlatformSessionMock.next_call(matching!(_)).answers(
        &|_, identity| {
            Ok(SessionView {
                user: UserView {
                    id: identity.user.id,
                    name: identity.user.name.clone(),
                    email: identity.user.email.clone(),
                    github_connected: false,
                },
                csrf_token: identity.session.csrf_token.clone(),
                workspace_ids: Vec::new(),
            })
        },
    ));
    let router = RouterFactory {
        trusted_proxies: TrustedProxies::default(),
        dispatcher: Arc::new(ApiDispatcher {
            builds: Arc::new(Unimock::new(())),
            auth: Arc::new(auth),
            platform: Arc::new(platform),
            health: Arc::new(Unimock::new(())),
            viewer: Arc::new(Unimock::new(())),
            access: Arc::new(Unimock::new(())),
            github: None,
            billing: None,
        }),
        upload: Arc::new(Unimock::new(())),
        origins: AdmittedOrigins::new(APP_ORIGIN.into(), false),
        billing_configured: false,
    }
    .build()
    .unwrap();

    let issue = checked(
        router.clone(),
        request(
            "/v1/auth/magic-links",
            json!({"email":"person@example.com", "returnTo":RETURN_TO}),
        ),
    )
    .await;
    assert_eq!(issue.status(), StatusCode::ACCEPTED);

    let exchange = checked(router, request("/v1/auth/callback", json!({"token":token}))).await;
    assert_eq!(exchange.status(), StatusCode::OK);
    assert!(
        exchange.headers()[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .contains(&credential)
    );
    let body: Value =
        serde_json::from_slice(&to_bytes(exchange.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["returnTo"], RETURN_TO);
}

fn request(path: &str, body: Value) -> Request<Body> {
    let mut request = Request::builder()
        .method("POST")
        .uri(path)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, APP_ORIGIN)
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
    request
}

fn now() -> DateTime<Utc> {
    "2026-09-23T12:00:00Z".parse().unwrap()
}

fn user(created_at: DateTime<Utc>) -> User {
    User {
        id: UserId(Uuid::from_u128(7)),
        email: "person@example.com".into(),
        name: "Person".into(),
        created_at,
    }
}
