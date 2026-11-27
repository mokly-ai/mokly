//! Every session-cookie response uses the client admitted for that request.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::service::{Authenticator, AuthenticatorMock, Identity, LinkVerified, SessionIssued};
use mkc_domain::client_origins::{ClientOrigin, DESKTOP_ORIGIN};
use mkc_domain::ids::UserId;
use mkc_store_interface::session::Session;
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::dispatch::{ApiDispatcher, Dispatcher, Request};
use crate::github::service::{CallbackMock, GitHubIntegration};
use crate::operation::Operation;
use crate::platform::service::PlatformSessionMock;
use crate::views::account::{SessionView, UserView};

#[tokio::test]
async fn all_five_cookie_responses_use_the_current_request_origin() {
    for (client, origin, same_site) in [
        (ClientOrigin::App, "https://app.example.com", "Lax"),
        (ClientOrigin::Desktop, DESKTOP_ORIGIN, "None"),
    ] {
        for operation in [
            Operation::VerifyMagicLink,
            Operation::VerifyPreviewSignIn,
            Operation::VerifyGitHubSignIn,
            Operation::RotateSession,
            Operation::SignOut,
        ] {
            let dispatcher = dispatcher(operation, client);
            let reply = dispatcher
                .dispatch(request(operation, origin))
                .unwrap()
                .finish()
                .await
                .unwrap();
            let (credential, max_age) = match operation {
                Operation::SignOut => ("", 0),
                Operation::RotateSession => ("fresh", 86_400),
                _ => ("fresh", 2_592_000),
            };
            assert_eq!(
                reply.cookie.unwrap(),
                format!(
                    "mkc_session={credential}; Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age={max_age}"
                ),
                "{operation:?}"
            );
        }
    }
}

fn dispatcher(operation: Operation, client: ClientOrigin) -> ApiDispatcher {
    let origin = AuthenticatorMock::origin
        .next_call(matching!(_))
        .returns(Ok(client));
    let auth: Arc<dyn Authenticator> = match operation {
        Operation::VerifyMagicLink => Arc::new(Unimock::new((
            origin,
            AuthenticatorMock::verify
                .next_call(matching!("token", Some("old")))
                .answers(&|_, _, _| Ok(verified())),
        ))),
        Operation::VerifyPreviewSignIn => Arc::new(Unimock::new((
            AuthenticatorMock::preview_sign_in_available
                .next_call(matching!())
                .returns(true),
            origin,
            AuthenticatorMock::preview
                .next_call(matching!((previous, _) if previous.as_deref() == Some("old")))
                .answers(&|_, _, _| {
                    Ok(Box::new(|password| {
                        assert_eq!(password, "preview password");
                        Ok(Box::new(|| Ok(issued())))
                    }))
                }),
        ))),
        Operation::VerifyGitHubSignIn => Arc::new(Unimock::new((
            origin,
            AuthenticatorMock::authenticate
                .next_call(matching!("old"))
                .answers(&|_, _| Ok(identity())),
        ))),
        Operation::RotateSession => Arc::new(Unimock::new((
            AuthenticatorMock::authenticate
                .next_call(matching!("old"))
                .answers(&|_, _| Ok(identity())),
            AuthenticatorMock::csrf
                .next_call(matching!(_, _, Some("csrf")))
                .returns(Ok(client)),
            AuthenticatorMock::rotate
                .next_call(matching!("old"))
                .answers(&|_, _| Ok(issued())),
        ))),
        Operation::SignOut => Arc::new(Unimock::new((
            AuthenticatorMock::authenticate
                .next_call(matching!("old"))
                .answers(&|_, _| Ok(identity())),
            AuthenticatorMock::csrf
                .next_call(matching!(_, _, Some("csrf")))
                .returns(Ok(client)),
            AuthenticatorMock::sign_out
                .next_call(matching!("old"))
                .returns(Ok(())),
        ))),
        _ => unreachable!(),
    };
    let github = (operation == Operation::VerifyGitHubSignIn).then(|| {
        Arc::new(Unimock::new(
            CallbackMock
                .next_call(matching!(_, _, Some("old"), _))
                .answers(&|_, _, _, _, _| Ok(verified())),
        )) as Arc<dyn GitHubIntegration>
    });
    let platform = if operation == Operation::SignOut {
        Unimock::new(())
    } else {
        Unimock::new(
            PlatformSessionMock
                .next_call(matching!(_))
                .answers(&|_, value| {
                    Ok(SessionView {
                        user: UserView {
                            id: value.user.id,
                            email: value.user.email.clone(),
                            name: value.user.name.clone(),
                            github_connected: false,
                        },
                        csrf_token: value.session.csrf_token.clone(),
                        workspace_ids: Vec::new(),
                    })
                }),
        )
    };
    ApiDispatcher {
        builds: Arc::new(Unimock::new(())),
        auth,
        platform: Arc::new(platform),
        github,
        billing: None,
        health: Arc::new(Unimock::new(())),
        viewer: Arc::new(Unimock::new(())),
        access: Arc::new(Unimock::new(())),
        preview_hash_slots: Default::default(),
    }
}

fn request(operation: Operation, origin: &str) -> Request {
    let body = match operation {
        Operation::VerifyMagicLink => br#"{"token":"token"}"#.to_vec(),
        Operation::VerifyPreviewSignIn => br#"{"password":"preview password"}"#.to_vec(),
        Operation::VerifyGitHubSignIn => {
            br#"{"code":"code","state":"state","codeVerifier":"verifier"}"#.to_vec()
        }
        _ => Vec::new(),
    };
    Request {
        operation,
        params: HashMap::new(),
        body,
        credential: Some("old".into()),
        csrf: Some("csrf".into()),
        origin: Some(origin.into()),
        peer: "127.0.0.1".into(),
        query: String::new(),
        mutating: true,
        webhook: None,
        billing_signature: None,
    }
}

fn identity() -> Identity {
    let now: DateTime<Utc> = "2026-10-15T12:00:00Z".parse().unwrap();
    let user_id = UserId(Uuid::from_u128(7));
    Identity {
        user: User {
            id: user_id,
            name: "Person".into(),
            email: "person@example.com".into(),
            created_at: now,
        },
        session: Session {
            token_hash: "hash".into(),
            user_id,
            csrf_token: "csrf".into(),
            created_at: now - Duration::days(29),
            expires_at: now + Duration::days(1),
            last_seen_at: now,
        },
    }
}

fn issued() -> SessionIssued {
    SessionIssued {
        identity: identity(),
        credential: "fresh".into(),
    }
}

fn verified() -> LinkVerified {
    LinkVerified {
        session: issued(),
        return_to: "/dashboard".into(),
    }
}
