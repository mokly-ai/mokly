//! Reusable strict worker mocks; no external IO or real clock reads.

use std::future;
use std::sync::Arc;
use std::time::Duration;

use mkc_build_interface::runner::BuildRunner;
use mkc_github_interface::credentials::Tokens;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::BuildUploadGrantsMock;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use unimock::{Clause, MockFn, Unimock, matching};

use crate::build_worker::service::{
    BuildLeaseClock, BuildLeaseClockMock, BuildWorker, BuildWorkerConfig, BuildWorkerFactory,
    DatabaseBuildWorkerFactory,
};
use crate::tests::build_fixtures::*;
use crate::transaction::Transactions;

pub(super) fn worker(
    queries: Unimock,
    credentials: Arc<dyn Tokens>,
    runner: Arc<dyn BuildRunner>,
    clock: Arc<dyn BuildLeaseClock>,
    limit: usize,
) -> Arc<dyn BuildWorker> {
    worker_with(transactions(queries), credentials, runner, clock, limit)
}

pub(super) fn worker_with(
    transactions: Arc<dyn Transactions>,
    credentials: Arc<dyn Tokens>,
    runner: Arc<dyn BuildRunner>,
    clock: Arc<dyn BuildLeaseClock>,
    limit: usize,
) -> Arc<dyn BuildWorker> {
    DatabaseBuildWorkerFactory {
        transactions,
        runtime: runtime(),
        credentials,
        runner,
        clock,
    }
    .create(BuildWorkerConfig {
        api_origin: "https://api.example.com".into(),
        per_process: limit,
    })
}

pub(super) fn start_queries() -> impl Clause {
    start_queries_at(1)
}

pub(super) fn expiration() -> impl Clause {
    PublicationsMock::fail_build_uploads
        .some_call(matching!(&BUILD, _, PublicationFailure::Expired, _))
        .answers(&|_, _, since, _, at| {
            assert_eq!(since, now());
            assert_eq!(at, now());
            Ok(0)
        })
}

pub(super) fn start_queries_at(number: i32) -> impl Clause {
    (
        BuildsMock::claim_build
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let mut queued = build(BuildState::Queued);
                queued.attempt = number - 1;
                Ok(Some(queued))
            })),
        BuildsMock::start_build
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, id, attempt| {
                assert_eq!(id, BUILD);
                assert_eq!(
                    attempt.lease_expires_at,
                    now() + chrono::Duration::minutes(2)
                );
                assert_eq!(attempt.deadline_at, now() + chrono::Duration::minutes(15));
                let mut running = build(BuildState::Running);
                running.attempt = number;
                running.attempt_operation_id = Some(attempt.operation_id);
                running.lease_token = Some(attempt.lease_token);
                Ok(Some(running))
            })),
        BuildUploadGrantsMock::mint_build_grant
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, grant| {
                assert_eq!(grant.attempt, number);
                assert_eq!(grant.expires_at, now() + chrono::Duration::minutes(15));
                assert_eq!(grant.token_digest.len(), 32);
                assert!(grant.consumed_at.is_none());
                Ok(true)
            })),
    )
}

pub(super) fn clock() -> Arc<dyn BuildLeaseClock> {
    Arc::new(Unimock::new(
        BuildLeaseClockMock::sleep
            .each_call(matching!(_))
            .answers(&|_, duration| {
                assert_eq!(duration, Duration::from_secs(30));
                Box::pin(future::pending())
            }),
    ))
}
