//! Health stays available while admitted preview attempts wait for hashing.

#![allow(clippy::unwrap_used)]

use std::future::Future;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

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
use mkc_domain::ids::UserId;
use mkc_store_interface::rate_limit::RateLimitsMock;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use mkc_store_interface::user::{User, UsersMock};
use serde_json::Value;
use tokio::runtime::{Builder, Runtime};
use tokio::sync::Semaphore;
use tokio::task::spawn_blocking;
use tokio::time::timeout;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::contract::response_capture::checked;
use crate::contract::route_fixture::routes;
use crate::dispatch::ApiDispatcher;
use crate::health::{DatabaseHealth, HealthClockMock};
use crate::operation::Operation;
use crate::platform::service::PlatformSessionMock;
use crate::preview_dispatch::PreviewHashSlots;
use crate::router::RouterBuilder;
use crate::views::account::{SessionView, UserView};

use super::contract_tests::factory;

#[path = "preview_capacity_tests.rs"]
mod capacity_tests;

const VALID_PASSWORD: &str = "preview password";

#[test]
fn health_answers_while_admitted_preview_password_attempts_wait() {
    let admitted = Arc::new(AtomicUsize::new(0));
    let (router, slots) = router(admitted.clone(), false);
    single_worker_runtime()
        .block_on(async {
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
                admission_fence().await?;
                assert_eq!(admitted.load(Ordering::SeqCst), 3);
                for attempt in &mut attempts {
                    assert!(
                        poll!(attempt.as_mut()).is_pending(),
                        "a preview attempt answered before the hash permits were released"
                    );
                }
                let health_reply = checked(
                    router.clone(),
                    request(Operation::GetHealth, 1, Body::empty()),
                );
                let health =
                    wait_for_worker(health_reply, "timed out waiting for the health reply").await?;
                assert_eq!(health.status(), StatusCode::OK);
                for attempt in &mut attempts {
                    assert!(
                        poll!(attempt.as_mut()).is_pending(),
                        "a preview attempt answered before the hash permits were released"
                    );
                }
                attempts
            };

            for response in wait_for_worker(
                join_all(attempts),
                "timed out waiting for the preview password refusals",
            )
            .await?
            {
                assert_eq!(response.status(), StatusCode::BAD_REQUEST);
                let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
                let body: Value = serde_json::from_slice(&bytes).unwrap();
                assert_eq!(body["error"]["reason"], "magic-link-invalid");
            }
            Ok::<(), &str>(())
        })
        .unwrap();
}

fn single_worker_runtime() -> Runtime {
    Builder::new_current_thread()
        .max_blocking_threads(1)
        .enable_time()
        .build()
        .unwrap()
}

async fn admission_fence() -> Result<(), &'static str> {
    wait_for_worker(
        spawn_blocking(|| ()),
        "timed out waiting for the preview admission fence",
    )
    .await?
    .unwrap();
    Ok(())
}

async fn wait_for_worker<F: Future>(
    work: F,
    pending: &'static str,
) -> Result<F::Output, &'static str> {
    timeout(Duration::from_secs(30), work)
        .await
        .map_err(|_| pending)
}

fn router(admitted: Arc<AtomicUsize>, issue_session: bool) -> (Router, Arc<Semaphore>) {
    let mut factory = factory();
    let now: DateTime<Utc> = "2026-11-25T09:00:00Z".parse().unwrap();
    let verifier = PreviewVerifier::parse(
        "$scrypt$ln=1,r=8,p=1$AAECAwQFBgcICQoLDA0ODw$Db3SFFSv6Uj4LE9jYfAMY0Uo2MUgSZ8u2Nv1SDql4KQ",
    )
    .unwrap();
    let rate_limit = RateLimitsMock::rate_limit
        .each_call(matching!(_))
        .answers(&|_, _| Ok(None));
    let insert_rate_limit = RateLimitsMock::insert_rate_limit
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| {
            admitted.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }));
    let clock = RuntimeMock::now.each_call(matching!()).returns(now);
    let (queries, runtime, platform) =
        if issue_session {
            let id = Uuid::from_u128(7);
            let user = User {
                id: UserId(id),
                name: "Preview".into(),
                email: "preview@mock.test".into(),
                created_at: now,
            };
            (
                Unimock::new((
                    rate_limit,
                    insert_rate_limit,
                    UsersMock::find_user
                        .next_call(matching!("preview@mock.test"))
                        .returns(Ok(Some(user))),
                    SessionsMock::insert_session
                        .next_call(matching!(_))
                        .returns(Ok(())),
                )),
                Unimock::new((
                    clock,
                    RuntimeMock::secret
                        .each_call(matching!())
                        .answers(&|_| Ok("fixture".into())),
                    RuntimeMock::id.next_call(matching!()).returns(id),
                )),
                Unimock::new(PlatformSessionMock.next_call(matching!(_)).answers(
                    &|_, identity| {
                        Ok(SessionView {
                            user: UserView {
                                id: identity.user.id,
                                email: identity.user.email.clone(),
                                name: identity.user.name.clone(),
                                github_connected: false,
                            },
                            csrf_token: identity.session.csrf_token.clone(),
                            workspace_ids: Vec::new(),
                        })
                    },
                )),
            )
        } else {
            (
                Unimock::new((rate_limit, insert_rate_limit)),
                Unimock::new(clock),
                Unimock::new(()),
            )
        };
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            })),
    );
    let preview_hash_slots = PreviewHashSlots::default();
    let slots = preview_hash_slots.checks.clone();
    factory.dispatcher = Arc::new(ApiDispatcher {
        auth: Arc::new(AuthService {
            store: Arc::new(store),
            mailer: Arc::new(Unimock::new(())),
            runtime: Arc::new(runtime),
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
        platform: Arc::new(platform),
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
