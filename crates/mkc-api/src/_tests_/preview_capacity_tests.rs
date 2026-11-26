//! Preview password requests share a fixed capacity through admission and hashing.

#![allow(clippy::unwrap_used)]

use std::collections::VecDeque;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::StatusCode;
use axum::response::Response;
use futures_util::FutureExt;
use serde_json::{Value, json};

use crate::contract::response_capture::checked;
use crate::operation::Operation;

use super::{
    VALID_PASSWORD, admission_fence, request, router, single_worker_runtime, wait_for_worker,
};

#[test]
fn full_preview_password_queue_refuses_before_admission_and_reuses_places() {
    let admitted = Arc::new(AtomicUsize::new(0));
    let (router, hash_slots) = router(admitted.clone(), true);
    single_worker_runtime()
        .block_on(async {
            let mut attempts = VecDeque::new();
            {
                let _held = hash_slots.try_acquire_many(2).unwrap();
                for peer in 1..=10 {
                    let password = if peer == 2 {
                        VALID_PASSWORD
                    } else {
                        "wrong password"
                    };
                    let mut attempt = Box::pin(exchange(&router, peer, password));
                    assert!(response_after_dispatch(attempt.as_mut()).await?.is_none());
                    attempts.push_back(attempt);
                }
                assert_eq!(admitted.load(Ordering::SeqCst), 10);

                let mut overflow = Box::pin(exchange(&router, 11, "wrong password"));
                let refusal = response_after_dispatch(overflow.as_mut()).await?;
                assert_eq!(
                    refusal.as_ref().map(Response::status),
                    Some(StatusCode::SERVICE_UNAVAILABLE),
                    "the eleventh preview attempt must answer while both hash slots are held"
                );
                let bytes = to_bytes(refusal.unwrap().into_body(), usize::MAX)
                    .await
                    .unwrap();
                let body: Value = serde_json::from_slice(&bytes).unwrap();
                assert_eq!(body["error"]["reason"], "unavailable");
                assert_eq!(
                    admitted.load(Ordering::SeqCst),
                    10,
                    "overflow must write no admission row"
                );

                let health = checked(
                    router.clone(),
                    request(Operation::GetHealth, 1, Body::empty()),
                );
                assert_eq!(
                    wait_for_worker(
                        health,
                        "timed out waiting for health with a full preview queue"
                    )
                    .await?
                    .status(),
                    StatusCode::OK
                );

                attempts.truncate(9);
                let mut retry = Box::pin(exchange(&router, 11, "wrong password"));
                assert!(response_after_dispatch(retry.as_mut()).await?.is_none());
                assert_eq!(
                    admitted.load(Ordering::SeqCst),
                    11,
                    "dropping a waiting request must free a place"
                );
                attempts.push_back(retry);
            }

            for (peer, expected_status) in [(12, StatusCode::BAD_REQUEST), (13, StatusCode::OK)] {
                let response = wait_for_worker(
                    attempts.pop_front().unwrap(),
                    "timed out waiting for a queued preview password result",
                )
                .await?;
                assert_eq!(response.status(), expected_status);

                let mut attempt = Box::pin(exchange(&router, peer, "wrong password"));
                assert!(response_after_dispatch(attempt.as_mut()).await?.is_none());
                assert_eq!(
                    admitted.load(Ordering::SeqCst),
                    usize::from(peer),
                    "a {expected_status} reply must free a place"
                );
                attempts.push_back(attempt);
            }
            Ok::<(), &str>(())
        })
        .unwrap();
}

async fn exchange(router: &Router, peer: u8, password: &str) -> Response {
    checked(
        router.clone(),
        request(
            Operation::VerifyPreviewSignIn,
            peer,
            Body::from(json!({ "password": password }).to_string()),
        ),
    )
    .await
}

async fn response_after_dispatch<F: Future>(
    mut attempt: Pin<&mut F>,
) -> Result<Option<F::Output>, &'static str> {
    let response = attempt.as_mut().now_or_never();
    if response.is_some() {
        return Ok(response);
    }
    admission_fence().await?;
    Ok(attempt.now_or_never())
}
