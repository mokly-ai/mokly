//! Public configuration answers through the API router and dispatcher.

#![allow(clippy::unwrap_used)]

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode, header};
use mkc_auth::preview_verifier::PreviewVerifier;
use mkc_auth::service::{AuthService, PreviewSignIn};
use serde_json::{Value, json};
use unimock::Unimock;

use crate::billing::service::BillingService;
use crate::contract::response_capture::checked;
use crate::contract::response_validation::document;
use crate::dispatch::ApiDispatcher;
use crate::github::service::GitHubIntegration;
use crate::router::RouterBuilder;

use super::contract_tests::factory;

const PATH: &str = "/v1/configuration";

#[tokio::test]
async fn configuration_is_public_and_reports_github_in_production() {
    let router = router(Some(Arc::new(Unimock::new(()))), None, None);
    assert_eq!(
        configuration(router).await,
        json!({"github": true, "billing": false, "previewPassword": null})
    );
    assert_eq!(document()["paths"][PATH]["get"]["security"], json!([]));
}

#[tokio::test]
async fn configuration_reports_billing_and_hides_a_preview_account_without_a_verifier() {
    let router = router(
        None,
        Some(Arc::new(Unimock::new(()))),
        Some(PreviewSignIn::new("preview@mock.test".into(), None)),
    );
    assert_eq!(
        configuration(router).await,
        json!({"github": false, "billing": true, "previewPassword": null})
    );
}

#[tokio::test]
async fn configuration_reports_the_preview_account_when_a_verifier_is_configured() {
    let verifier = PreviewVerifier::parse(
        "$scrypt$ln=14,r=8,p=5$AAECAwQFBgcICQoLDA0ODw$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    )
    .unwrap();
    let router = router(
        None,
        None,
        Some(PreviewSignIn::new(
            "reviewer@mock.test".into(),
            Some(verifier),
        )),
    );
    assert_eq!(
        configuration(router).await,
        json!({
            "github": false,
            "billing": false,
            "previewPassword": {"account": "reviewer@mock.test"}
        })
    );
}

fn router(
    github: Option<Arc<dyn GitHubIntegration>>,
    billing: Option<Arc<dyn BillingService>>,
    preview_sign_in: Option<PreviewSignIn>,
) -> Router {
    let mut factory = factory();
    factory.billing_configured = billing.is_some();
    factory.dispatcher = Arc::new(ApiDispatcher {
        builds: Arc::new(Unimock::new(())),
        auth: Arc::new(AuthService {
            store: Arc::new(Unimock::new(())),
            mailer: Arc::new(Unimock::new(())),
            runtime: Arc::new(Unimock::new(())),
            origins: factory.origins.clone(),
            preview_sign_in,
        }),
        platform: Arc::new(Unimock::new(())),
        health: Arc::new(Unimock::new(())),
        viewer: Arc::new(Unimock::new(())),
        access: Arc::new(Unimock::new(())),
        github,
        billing,
    });
    factory.build().unwrap()
}

async fn configuration(router: Router) -> Value {
    let mut request = Request::get(PATH).body(Body::empty()).unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo("127.0.0.1:1234".parse::<SocketAddr>().unwrap()));
    let response = checked(router, request).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
    assert_eq!(response.headers().get(header::SET_COOKIE), None);
    serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
}
