//! Signature rejection, original-byte persistence and delivery idempotency.

use std::sync::Arc;

use mkc_github_interface::webhooks::WebhookVerifierMock;
use mkc_store_interface::github_delivery::{Delivery, GitHubDeliveriesMock};
use mkc_store_interface::github_state::DeliveryStatus;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::ApiError;
use crate::github::input::IncomingDelivery;
use crate::github::service::GitHubIntegration;
use crate::github_error::GitHubError;

use super::support::{now, pure, service};

fn incoming() -> IncomingDelivery {
    IncomingDelivery {
        id: Uuid::from_u128(100).to_string(),
        event: "ping".into(),
        signature: "signature".into(),
        body: b"{  \"zen\": \"original bytes\" }\n".to_vec(),
    }
}

fn delivery(status: DeliveryStatus) -> Delivery {
    let input = incoming();
    Delivery {
        id: input.id.parse().unwrap(),
        event: input.event,
        body: input.body,
        received_at: now(),
        due_at: now(),
        attempts: 8,
        status,
        lease: None,
        lease_until: None,
        last_failure: None,
    }
}

#[test]
fn invalid_signature_has_no_store_effects() {
    let mut service = pure();
    service.verifier = Arc::new(Unimock::new(
        WebhookVerifierMock::verify
            .some_call(matching!(_, _))
            .returns(Ok(false)),
    ));
    assert!(matches!(
        service.accept(incoming()),
        Err(ApiError::GitHub(GitHubError::WebhookSignatureInvalid))
    ));
}

#[test]
fn verified_delivery_persists_original_bytes_as_a_pending_job() {
    let queries = Unimock::new((
        GitHubDeliveriesMock::github_delivery
            .some_call(matching!(_))
            .returns(Ok(None)),
        GitHubDeliveriesMock::save_github_delivery
            .some_call(matching!(_))
            .answers(&|_, delivery| {
                assert_eq!(delivery.body, incoming().body);
                assert_eq!(delivery.status, DeliveryStatus::Pending);
                assert_eq!(delivery.attempts, 0);
                Ok(())
            }),
    ));
    let mut service = service(queries);
    service.verifier = Arc::new(Unimock::new(
        WebhookVerifierMock::verify
            .some_call(matching!(_, _))
            .returns(Ok(true)),
    ));
    service.accept(incoming()).unwrap();
}

#[test]
fn successful_redelivery_is_acknowledged_without_reapplying_effects() {
    let mut service = service(Unimock::new(
        GitHubDeliveriesMock::github_delivery
            .some_call(matching!(_))
            .returns(Ok(Some(delivery(DeliveryStatus::Done)))),
    ));
    service.verifier = Arc::new(Unimock::new(
        WebhookVerifierMock::verify
            .some_call(matching!(_, _))
            .returns(Ok(true)),
    ));
    service.accept(incoming()).unwrap();
}

#[test]
fn mismatched_delivery_id_reuse_is_rejected() {
    let mut service = service(Unimock::new(
        GitHubDeliveriesMock::github_delivery
            .some_call(matching!(_))
            .returns(Ok(Some(delivery(DeliveryStatus::Done)))),
    ));
    service.verifier = Arc::new(Unimock::new(
        WebhookVerifierMock::verify
            .some_call(matching!(_, _))
            .returns(Ok(true)),
    ));
    let mut input = incoming();
    input.body.push(b' ');
    assert!(matches!(
        service.accept(input),
        Err(ApiError::ValidationFailed)
    ));
}

#[test]
fn signed_redelivery_requeues_an_exhausted_job() {
    let mut service = service(Unimock::new((
        GitHubDeliveriesMock::github_delivery
            .some_call(matching!(_))
            .returns(Ok(Some(delivery(DeliveryStatus::Failed)))),
        GitHubDeliveriesMock::save_github_delivery
            .some_call(matching!(_))
            .answers(&|_, delivery| {
                assert_eq!(delivery.status, DeliveryStatus::Pending);
                assert_eq!(delivery.attempts, 0);
                assert_eq!(delivery.due_at, now());
                Ok(())
            }),
    )));
    service.verifier = Arc::new(Unimock::new(
        WebhookVerifierMock::verify
            .some_call(matching!(_, _))
            .returns(Ok(true)),
    ));
    service.accept(incoming()).unwrap();
}
