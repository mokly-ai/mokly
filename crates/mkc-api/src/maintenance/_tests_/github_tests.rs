//! GitHub cleanup uses stable cutoffs and exhausts bounded query batches.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_auth::runtime::RuntimeMock;
use mkc_store_interface::error;
use mkc_store_interface::github_retention::GitHubRetentionMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::maintenance::github::{GitHubPrune, GitHubPruner, PruneReport, Retention};

fn now() -> DateTime<Utc> {
    "2026-09-22T12:00:00Z".parse().unwrap()
}

fn service(store: Unimock) -> GitHubPrune {
    GitHubPrune {
        store: Arc::new(store),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now.next_call(matching!()).returns(now()),
        )),
        retention: Retention {
            oauth_flows: Duration::from_secs(86_400),
            deliveries: Duration::from_secs(2_592_000),
        },
    }
}

#[test]
fn stable_cutoffs_exhaust_every_full_batch() {
    let queries = Unimock::new((
        GitHubRetentionMock::prune_github_oauth_flows
            .next_call(matching!((cutoff, 1000) if *cutoff == now() - TimeDelta::days(1)))
            .returns(Ok(1000)),
        GitHubRetentionMock::prune_github_oauth_flows
            .next_call(matching!((cutoff, 1000) if *cutoff == now() - TimeDelta::days(1)))
            .returns(Ok(2)),
        GitHubRetentionMock::prune_github_deliveries
            .next_call(matching!((cutoff, 1000) if *cutoff == now() - TimeDelta::days(30)))
            .returns(Ok(3)),
    ));
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            }))
            .n_times(3),
    );
    let pruner: &dyn GitHubPruner = &service(store);
    assert_eq!(
        pruner.prune().unwrap(),
        PruneReport {
            oauth_flows: 1002,
            deliveries: 3,
        }
    );
}

#[test]
fn query_failure_returns_no_partial_report() {
    let queries = Unimock::new(
        GitHubRetentionMock::prune_github_oauth_flows
            .next_call(matching!(_, 1000))
            .returns(Err(error::Error::internal(io::Error::other(
                "database unavailable",
            )))),
    );
    let store = Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            })),
    );
    assert!(matches!(service(store).prune(), Err(ApiError::Internal(_))));
}
