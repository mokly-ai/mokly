//! A transaction replay after a settled run leaves no infrastructure warning.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mkc_domain::values::Plan;
use mkc_github_interface::credentials::TokensMock;
use mkc_github_interface::error::Error;
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_state::BuildState;
use tracing::instrument::WithSubscriber;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::error::Result;
use crate::tests::build_fixtures::*;
use crate::transaction::{QueryWork, TransactionsMock};

use super::support::{clock, expiration, start_queries, worker_with};
use super::warnings::capture;

/// Counts calls from zero, so a mock can answer the replayed run differently.
fn counter() -> impl Fn() -> usize {
    let calls = AtomicUsize::new(0);
    move || calls.fetch_add(1, Ordering::SeqCst)
}

/// Run the work twice, as the store does after a rolled-back commit.
fn replay(work: &mut QueryWork<'_>, queries: &Unimock) -> Result<()> {
    let mut queries = queries.clone();
    work(&mut queries)?;
    work(&mut queries)
}

#[tokio::test]
async fn finalization_replay_that_finds_the_attempt_settled_does_not_warn() {
    let lookup = counter();
    let queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        start_queries(),
        BuildsMock::build
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                let state = if lookup() == 0 {
                    BuildState::Running
                } else {
                    BuildState::Queued
                };
                Ok(Some(build(state)))
            }))
            .n_times(2),
        expiration(),
        BuildsMock::finish_build
            .some_call(matching!(_, _, _))
            .returns(Ok(true)),
    ));
    let transaction = counter();
    let transactions = Unimock::new(
        TransactionsMock::run
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                if transaction() == 0 {
                    work(&mut queries.clone())
                } else {
                    replay(work, &queries)
                }
            }))
            .n_times(2),
    );
    let credentials = Unimock::new(
        TokensMock::repository_read
            .some_call(matching!(1, 100))
            .returns(Err(Error::Unavailable)),
    );
    let worker = worker_with(
        Arc::new(transactions),
        Arc::new(credentials),
        Arc::new(Unimock::new(())),
        clock(),
        4,
    );
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("attempt required");
    };
    let (warnings, dispatch) = capture();
    worker
        .execute(*attempt)
        .with_subscriber(dispatch)
        .await
        .unwrap();
    assert_eq!(warnings.events(), []);
}

#[test]
fn lease_recovery_replay_that_claims_nothing_does_not_warn() {
    let lookup = counter();
    let queries = Unimock::new((
        BuildsMock::claim_build
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok((lookup() == 0).then(|| build(BuildState::Running)))
            }))
            .n_times(2),
        expiration(),
        BuildsMock::finish_build
            .some_call(matching!(_, _, _))
            .returns(Ok(true)),
    ));
    let transactions = Unimock::new(
        TransactionsMock::run
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                replay(work, &queries)
            })),
    );
    let worker = worker_with(
        Arc::new(transactions),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        4,
    );
    let (warnings, dispatch) = capture();
    let claim = tracing::dispatcher::with_default(&dispatch, || worker.claim().unwrap());
    assert!(matches!(claim, BuildClaim::Idle));
    assert_eq!(warnings.events(), []);
}
