//! Health stays available while admitted preview attempts wait for hashing.

#![allow(clippy::unwrap_used)]

use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode, header};
use chrono::{DateTime, Utc};
use futures_util::{future::join_all, poll};
use mkc_auth::preview_verifier::PreviewVerifier;
use mkc_auth::runtime::RuntimeMock;
use mkc_auth::service::{AuthService, PreviewSignIn};
use mkc_db::migration::CurrentMock;
use mkc_store_interface::rate_limit::RateLimitsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use serde_json::Value;
use tokio::runtime::Builder;
use tokio::sync::Semaphore;
use tokio::task::spawn_blocking;
use unimock::{MockFn, Unimock, matching};

use crate::contract::response_capture::checked;
use crate::contract::route_fixture::routes;
use crate::dispatch::ApiDispatcher;
use crate::health::{DatabaseHealth, HealthClockMock};
use crate::operation::Operation;
use crate::preview_dispatch::PreviewHashSlots;
use crate::router::RouterBuilder;

use super::contract_tests::factory;

#[test]
fn health_answers_while_admitted_preview_password_attempts_wait() {
    Builder::new_current_thread()
        .max_blocking_threads(1)
        .build()
        .unwrap()
        .block_on(async {
            let admitted = Arc::new(AtomicUsize::new(0));
            let (router, slots) = router(admitted.clone());
            let attempts = {
                let _held = slots.try_acquire_many(2).unwrap();
                let mut attempts: Vec<_> = (1..=3)
                    .map(|peer| {
                        Box::pin(checked(
                            router.clone(),
                            request(
                                Operation::VerifyPreviewSignIn,
                                peer,
                                Body::from(r#"{"password":"wrong password"}"#),
                            ),
                        ))
                    })
                    .collect();

                for attempt in &mut attempts {
                    assert!(
                        poll!(attempt.as_mut()).is_pending(),
                        "a preview attempt answered before the hash permits were released"
                    );
                }
                let admission_fence = spawn_blocking(|| ());
                admission_fence.await.unwrap();
                assert_eq!(admitted.load(Ordering::SeqCst), 3);
                for attempt in &mut attempts {
                    assert!(
                        poll!(attempt.as_mut()).is_pending(),
                        "a preview attempt answered before the hash permits were released"
                    );
                }
                let health = checked(router, request(Operation::GetHealth, 1, Body::empty())).await;
                assert_eq!(health.status(), StatusCode::OK);
                for attempt in &mut attempts {
                    assert!(
                        poll!(attempt.as_mut()).is_pending(),
                        "a preview attempt answered before the hash permits were released"
                    );
                }
                attempts
            };

            for response in join_all(attempts).await {
                assert_eq!(response.status(), StatusCode::BAD_REQUEST);
                let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
                let body: Value = serde_json::from_slice(&bytes).unwrap();
                assert_eq!(body["error"]["reason"], "magic-link-invalid");
            }
        });
}

fn router(admitted: Arc<AtomicUsize>) -> (Router, Arc<Semaphore>) {
    let mut factory = factory();
    let now: DateTime<Utc> = "2026-11-25T09:00:00Z".parse().unwrap();
    let verifier = PreviewVerifier::parse(
        "$scrypt$ln=1,r=8,p=1$AAECAwQFBgcICQoLDA0ODw$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    )
    .unwrap();
    let queries = Unimock::new((
        RateLimitsMock::rate_limit
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
        RateLimitsMock::insert_rate_limit
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    ));
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                admitted.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })),
    );
    let preview_hash_slots = PreviewHashSlots::default();
    let slots = preview_hash_slots.0.clone();
    factory.dispatcher = Arc::new(ApiDispatcher {
        auth: Arc::new(AuthService {
            store: Arc::new(store),
            mailer: Arc::new(Unimock::new(())),
            runtime: Arc::new(Unimock::new(
                RuntimeMock::now.each_call(matching!()).returns(now),
            )),
            origins: factory.origins.clone(),
            preview_sign_in: Some(PreviewSignIn::new(
                "preview@mock.test".into(),
                Some(verifier),
            )),
        }),
        health: Arc::new(DatabaseHealth {
            migrations: Arc::new(Unimock::new(
                CurrentMock.next_call(matching!()).returns(Ok(true)),
            )),
            clock: Arc::new(Unimock::new(
                HealthClockMock
                    .next_call(matching!())
                    .returns(Instant::now()),
            )),
            cache: Default::default(),
        }),
        preview_hash_slots,
        builds: Arc::new(Unimock::new(())),
        platform: Arc::new(Unimock::new(())),
        viewer: Arc::new(Unimock::new(())),
        access: Arc::new(Unimock::new(())),
        github: None,
        billing: None,
    });
    (factory.build().unwrap(), slots)
}

fn request(operation: Operation, peer: u8, body: Body) -> Request<Body> {
    let route = routes()
        .into_iter()
        .find(|route| route.operation_id == operation)
        .unwrap();
    let mut request = Request::builder()
        .method(route.method.as_str())
        .uri(&route.path)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, "https://app.example.com")
        .body(body)
        .unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from((
            Ipv4Addr::new(127, 0, 0, peer),
            1234,
        ))));
    request
}
