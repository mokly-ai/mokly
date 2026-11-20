//! Claim lock waits and transaction retries refresh times while identities stay fixed.

use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_auth::runtime::RuntimeMock;
use mkc_domain::values::Plan;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_grant::BuildUploadGrantsMock;
use mkc_store_interface::build_state::BuildState;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::build_worker::service::{
    BuildClaim, BuildWorkerConfig, BuildWorkerFactory, DatabaseBuildWorkerFactory,
};
use crate::tests::build_fixtures::*;
use crate::transaction::TransactionsMock;

#[test]
fn attempt_times_follow_claim_locks_and_refresh_on_retry_without_new_secrets() {
    let current = Arc::new(Mutex::new(now()));
    let claim_time = current.clone();
    let start_time = current.clone();
    let grant_time = current.clone();
    let runtime_time = current.clone();
    let grant_id = Uuid::from_u128(31);
    let queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        BuildsMock::claim_build
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, guard| {
                let before = guard.now();
                assert_eq!(before, *claim_time.lock().unwrap());
                *claim_time.lock().unwrap() = before + Duration::seconds(130);
                Ok(Some(build(BuildState::Queued)))
            }))
            .n_times(2),
        BuildsMock::start_build
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, id, attempt| {
                let at = *start_time.lock().unwrap();
                assert_eq!(id, BUILD);
                assert_eq!(attempt.now, at);
                assert_eq!(attempt.lease_expires_at, at + Duration::minutes(2));
                assert_eq!(attempt.deadline_at, at + Duration::minutes(15));
                assert_eq!(attempt.operation_id, OPERATION);
                assert_eq!(attempt.lease_token, LEASE);
                let mut running = build(BuildState::Running);
                running.started_at = Some(at);
                running.lease_expires_at = Some(attempt.lease_expires_at);
                running.deadline_at = Some(attempt.deadline_at);
                Ok(Some(running))
            }))
            .n_times(2),
        BuildUploadGrantsMock::mint_build_grant
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, grant| {
                let at = *grant_time.lock().unwrap();
                assert_eq!(grant.id, grant_id);
                assert_eq!(grant.created_at, at);
                assert_eq!(grant.expires_at, at + Duration::minutes(15));
                Ok(true)
            }))
            .n_times(2),
    ));
    let transactions = Unimock::new(
        TransactionsMock::run
            .some_call(matching!(false, _))
            .answers_arc(Arc::new(move |_, _, work| {
                let mut queries = queries.clone();
                work(&mut queries)?;
                work(&mut queries)
            })),
    );
    let runtime = Unimock::new((
        RuntimeMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| *runtime_time.lock().unwrap())),
        RuntimeMock::id.next_call(matching!()).returns(OPERATION),
        RuntimeMock::id.next_call(matching!()).returns(LEASE),
        RuntimeMock::id.next_call(matching!()).returns(grant_id),
        RuntimeMock::secret
            .some_call(matching!())
            .returns(Ok("a".repeat(64))),
    ));
    let factory: &dyn BuildWorkerFactory = &DatabaseBuildWorkerFactory {
        transactions: Arc::new(transactions),
        runtime: Arc::new(runtime),
        credentials: Arc::new(Unimock::new(())),
        runner: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
    };
    let worker = factory.create(BuildWorkerConfig {
        api_origin: "https://api.example.com".into(),
        per_process: 4,
    });
    assert!(matches!(worker.claim().unwrap(), BuildClaim::Attempt(_)));
    assert_eq!(*current.lock().unwrap(), now() + Duration::seconds(260));
}
