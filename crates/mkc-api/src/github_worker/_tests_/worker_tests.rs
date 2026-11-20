//! Durable retry classification and protection against stale completion leases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::RuntimeMock;
use mkc_store_interface::github_delivery::{Delivery, GitHubDeliveriesMock};
use mkc_store_interface::github_state::{DeliveryStatus, Failure};
use mkc_store_interface::store::{StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::ApiError;
use crate::github_worker::handlers::{PrepareEventMock, Prepared};
use crate::github_worker::worker::{DeliveryWorker, GitHubWorker};

fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

fn delivery() -> Delivery {
    Delivery {
        id: Uuid::from_u128(1),
        event: "push".into(),
        body: Vec::new(),
        received_at: now(),
        due_at: now(),
        attempts: 1,
        status: DeliveryStatus::Processing,
        lease: Some(Uuid::from_u128(2)),
        lease_until: Some(now() + Duration::minutes(5)),
        last_failure: None,
    }
}

fn worker(queries: Unimock, handler: Unimock) -> GitHubWorker {
    GitHubWorker {
        store: Arc::new(Unimock::new(
            StoreMock::transaction
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    work.run(&mut queries.clone()).map(|_| ())
                })),
        )),
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now.each_call(matching!()).returns(now()),
            RuntimeMock::id
                .some_call(matching!())
                .returns(Uuid::from_u128(2)),
        ))),
        handler: Arc::new(handler),
    }
}

#[test]
fn enormous_provider_delays_never_panic_or_schedule_an_early_retry() {
    let worker = worker(
        Unimock::new((
            GitHubDeliveriesMock::expire_github_deliveries
                .some_call(matching!(_))
                .returns(Ok(())),
            GitHubDeliveriesMock::claim_github_delivery
                .some_call(matching!(_, _, _))
                .returns(Ok(Some(delivery()))),
            GitHubDeliveriesMock::github_delivery
                .some_call(matching!(_))
                .returns(Ok(Some(delivery()))),
            GitHubDeliveriesMock::save_github_delivery
                .some_call(matching!(_))
                .answers(&|_, record| {
                    assert_eq!(record.due_at, DateTime::<Utc>::MAX_UTC);
                    assert_eq!(record.status, DeliveryStatus::Pending);
                    assert_eq!(record.last_failure, Some(Failure::RateLimited));
                    Ok(())
                }),
        )),
        Unimock::new(
            PrepareEventMock
                .some_call(matching!(_))
                .returns(Err(ApiError::RateLimited(i64::MAX))),
        ),
    );
    assert!(worker.run_once().unwrap());
}

#[test]
fn stale_worker_cannot_complete_a_reclaimed_delivery() {
    let mut reclaimed = delivery();
    reclaimed.lease = Some(Uuid::from_u128(3));
    let worker = worker(
        Unimock::new((
            GitHubDeliveriesMock::expire_github_deliveries
                .some_call(matching!(_))
                .returns(Ok(())),
            GitHubDeliveriesMock::claim_github_delivery
                .some_call(matching!(_, _, _))
                .returns(Ok(Some(delivery()))),
            GitHubDeliveriesMock::github_delivery
                .some_call(matching!(_))
                .returns(Ok(Some(reclaimed))),
        )),
        Unimock::new(
            PrepareEventMock
                .some_call(matching!(_))
                .returns(Ok(Prepared::Ignored)),
        ),
    );
    assert!(worker.run_once().unwrap());
}
