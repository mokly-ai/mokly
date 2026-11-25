//! Optional operations expose no request-validation detail when unconfigured.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::error::Error;
use mkc_auth::runtime::hash;
use mkc_auth::service::{Authenticator, AuthenticatorMock, Identity};
use mkc_domain::client_origins::ClientOrigin;
use mkc_domain::ids::UserId;
use mkc_store_interface::session::Session;
use mkc_store_interface::user::User;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::contract::route_fixture::routes;
use crate::dispatch::{ApiDispatcher, Dispatcher, Request, WebhookHeaders};
use crate::error::ApiError;
use crate::github::service::GitHubIntegration;
use crate::operation::Operation;

const APP_ORIGIN: &str = "https://app.example.com";

#[test]
fn unconfigured_optional_operations_precede_request_validation() {
    let auth = Unimock::new(
        AuthenticatorMock::preview_sign_in_available
            .each_call(matching!())
            .returns(false),
    );
    let dispatcher = dispatcher(Arc::new(auth), None);
    let operations = optional_operations();
    assert_eq!(operations.len(), 11);
    for operation in operations {
        let valid_body = valid_body(operation);
        for (body, origin, csrf) in [
            (b"{".to_vec(), Some(APP_ORIGIN), Some("csrf")),
            (valid_body.clone(), None, Some("csrf")),
            (
                valid_body.clone(),
                Some("https://wrong.example.com"),
                Some("csrf"),
            ),
            (valid_body, Some(APP_ORIGIN), None),
        ] {
            assert!(
                matches!(
                    dispatcher.dispatch(request(operation, body, origin, csrf)),
                    Err(ApiError::OperationUnavailable)
                ),
                "{operation:?} must be unavailable before request validation"
            );
        }
    }
}

#[test]
fn configured_preview_checks_origin_before_decoding_the_body() {
    let auth = Unimock::new((
        AuthenticatorMock::preview_sign_in_available
            .each_call(matching!())
            .returns(true),
        AuthenticatorMock::origin
            .next_call(matching!(None))
            .returns(Err(Error::CsrfFailed)),
        AuthenticatorMock::origin
            .next_call(matching!(Some(APP_ORIGIN)))
            .returns(Ok(ClientOrigin::App)),
    ));
    let dispatcher = dispatcher(Arc::new(auth), None);
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::VerifyPreviewSignIn,
            b"{".to_vec(),
            None,
            None,
        )),
        Err(ApiError::CsrfRejected)
    ));
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::VerifyPreviewSignIn,
            b"{".to_vec(),
            Some(APP_ORIGIN),
            None,
        )),
        Err(ApiError::ValidationFailed)
    ));
}

#[test]
fn configured_preview_passes_password_at_the_utf8_limit_unchanged() {
    let password = format!(" {} ", "é".repeat(511));
    let body = serde_json::to_vec(&json!({"password": password})).unwrap();
    let auth = Unimock::new((
        AuthenticatorMock::preview_sign_in_available
            .each_call(matching!())
            .returns(true),
        AuthenticatorMock::origin
            .each_call(matching!(Some(APP_ORIGIN)))
            .answers(&|_, _| Ok(ClientOrigin::App)),
        AuthenticatorMock::preview
            .each_call(matching!(_, Some("session"), "127.0.0.1"))
            .answers_arc(Arc::new(move |_, supplied, _, _| {
                assert_eq!(supplied, password);
                Err(Error::InvalidLink)
            })),
    ));
    let dispatcher = dispatcher(Arc::new(auth), None);
    let result = dispatcher.dispatch(request(
        Operation::VerifyPreviewSignIn,
        body,
        Some(APP_ORIGIN),
        None,
    ));
    assert!(
        matches!(result, Err(ApiError::MagicLinkInvalid)),
        "{:?}",
        result.err()
    );
}

#[test]
fn configured_github_checks_origin_and_body_as_before() {
    let auth = Unimock::new((
        AuthenticatorMock::origin
            .next_call(matching!(None))
            .returns(Err(Error::CsrfFailed)),
        AuthenticatorMock::origin
            .next_call(matching!(Some(APP_ORIGIN)))
            .returns(Ok(ClientOrigin::App)),
    ));
    let github: Arc<dyn GitHubIntegration> = Arc::new(Unimock::new(()));
    let dispatcher = dispatcher(Arc::new(auth), Some(github));
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::StartGitHubSignIn,
            b"{".to_vec(),
            None,
            None,
        )),
        Err(ApiError::CsrfRejected)
    ));
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::StartGitHubSignIn,
            b"{".to_vec(),
            Some(APP_ORIGIN),
            None,
        )),
        Err(ApiError::ValidationFailed)
    ));
}

#[test]
fn configured_github_checks_csrf_before_decoding_the_body() {
    let identity = identity();
    let auth = Unimock::new((
        AuthenticatorMock::authenticate
            .each_call(matching!("session"))
            .answers_arc(Arc::new(move |_, _| Ok(identity.clone()))),
        AuthenticatorMock::csrf
            .next_call(matching!(_, Some(APP_ORIGIN), None))
            .returns(Err(Error::CsrfFailed)),
        AuthenticatorMock::csrf
            .next_call(matching!(_, Some(APP_ORIGIN), Some("csrf")))
            .returns(Ok(ClientOrigin::App)),
    ));
    let github: Arc<dyn GitHubIntegration> = Arc::new(Unimock::new(()));
    let dispatcher = dispatcher(Arc::new(auth), Some(github));
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::ConnectGitHub,
            b"{".to_vec(),
            Some(APP_ORIGIN),
            None,
        )),
        Err(ApiError::CsrfRejected)
    ));
    assert!(matches!(
        dispatcher.dispatch(request(
            Operation::ConnectGitHub,
            b"{".to_vec(),
            Some(APP_ORIGIN),
            Some("csrf"),
        )),
        Err(ApiError::ValidationFailed)
    ));
}

#[test]
fn configured_webhook_still_requires_its_headers() {
    let github: Arc<dyn GitHubIntegration> = Arc::new(Unimock::new(()));
    let dispatcher = dispatcher(Arc::new(Unimock::new(())), Some(github));
    let mut request = request(Operation::ReceiveGitHubWebhook, b"{}".to_vec(), None, None);
    request.webhook = None;
    assert!(matches!(
        dispatcher.dispatch(request),
        Err(ApiError::ValidationFailed)
    ));
}

fn dispatcher(
    auth: Arc<dyn Authenticator>,
    github: Option<Arc<dyn GitHubIntegration>>,
) -> ApiDispatcher {
    ApiDispatcher {
        builds: Arc::new(Unimock::new(())),
        health: Arc::new(Unimock::new(())),
        viewer: Arc::new(Unimock::new(())),
        auth,
        platform: Arc::new(Unimock::new(())),
        github,
        billing: None,
        access: Arc::new(Unimock::new(())),
    }
}

fn optional_operations() -> Vec<Operation> {
    routes()
        .into_iter()
        .map(|route| route.operation_id)
        .filter(|operation| operation.optional_configuration().is_some())
        .collect()
}

fn identity() -> Identity {
    let now: DateTime<Utc> = "2026-09-27T09:00:00Z".parse().unwrap();
    let user_id = UserId(Uuid::from_u128(7));
    Identity {
        session: Session {
            token_hash: hash("session"),
            user_id,
            csrf_token: "csrf".to_owned(),
            created_at: now,
            expires_at: now + Duration::days(30),
            last_seen_at: now,
        },
        user: User {
            id: user_id,
            email: "person@example.com".to_owned(),
            name: "Person".to_owned(),
            created_at: now,
        },
    }
}

fn valid_body(operation: Operation) -> Vec<u8> {
    match operation {
        Operation::VerifyPreviewSignIn => br#"{"password":"preview password"}"#.to_vec(),
        Operation::ConnectGitHub | Operation::StartGitHubSignIn => b"{}".to_vec(),
        Operation::VerifyGitHubSignIn => {
            br#"{"code":"code","state":"state","codeVerifier":"verifier"}"#.to_vec()
        }
        Operation::InstallGitHubApp => {
            br#"{"workspaceId":"00000000-0000-0000-0000-000000000007"}"#.to_vec()
        }
        Operation::CompleteGitHubInstallation => {
            br#"{"installationId":7,"state":"state","codeVerifier":"verifier"}"#.to_vec()
        }
        _ => Vec::new(),
    }
}

fn request(
    operation: Operation,
    body: Vec<u8>,
    origin: Option<&str>,
    csrf: Option<&str>,
) -> Request {
    Request {
        operation,
        params: HashMap::new(),
        body,
        credential: Some("session".to_owned()),
        csrf: csrf.map(str::to_owned),
        origin: origin.map(str::to_owned),
        peer: "127.0.0.1".to_owned(),
        query: String::new(),
        mutating: true,
        webhook: Some(WebhookHeaders {
            delivery_id: "delivery".to_owned(),
            event: "push".to_owned(),
            signature: "sha256=signature".to_owned(),
        }),
        billing_signature: None,
    }
}
