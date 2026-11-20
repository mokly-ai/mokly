//! Cleanup keeps cutoffs and committed counts stable across bounded transactions.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_store_interface::desktop_grant::DesktopGrantsMock;
use mkc_store_interface::error;
use mkc_store_interface::magic_link::MagicLinksMock;
use mkc_store_interface::rate_limit::RateLimitsMock;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::prune::{AuthPruner, PruneReport, Pruner, Retention};
use crate::runtime::RuntimeMock;

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-17T12:00:00Z".parse().unwrap()
}

pub(super) fn service(store: Unimock, runtime: Unimock) -> AuthPruner {
    AuthPruner {
        store: Arc::new(store),
        runtime: Arc::new(runtime),
        retention: Retention {
            links: Duration::from_secs(604_800),
            sessions: Duration::from_secs(86_400),
            rate_limits: Duration::from_secs(86_400),
        },
    }
}

#[test]
fn cutoffs_and_counts_are_stable_across_transaction_retries() {
    let link_calls = Arc::new(AtomicUsize::new(0));
    let calls = Arc::new(Mutex::new(Vec::new()));
    let observed = calls.clone();
    let queries = Unimock::new((
        MagicLinksMock::prune_magic_links
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, cutoff, batch| {
                observed
                    .lock()
                    .unwrap()
                    .push(("links", cutoff, batch.limit));
                Ok(match link_calls.fetch_add(1, Ordering::SeqCst) {
                    0 => 99,
                    1 => 1000,
                    2 => 88,
                    3 => 2,
                    _ => 0,
                })
            }))
            .at_least_times(0),
        DesktopGrantsMock::prune_desktop_grants
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, cutoff, batch| {
                    calls.lock().unwrap().push(("grants", cutoff, batch.limit));
                    Ok(5)
                }
            }))
            .at_least_times(0),
        SessionsMock::prune_sessions
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, expiry, seen, batch| {
                    assert_eq!(seen, now() - TimeDelta::days(8));
                    calls
                        .lock()
                        .unwrap()
                        .push(("sessions", expiry, batch.limit));
                    Ok(3)
                }
            }))
            .at_least_times(0),
        RateLimitsMock::prune_rate_limits
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, cutoff, batch| {
                    calls.lock().unwrap().push(("rates", cutoff, batch.limit));
                    Ok(4)
                }
            }))
            .at_least_times(0),
    ));
    let transactions = Arc::new(AtomicUsize::new(0));
    let observed_transactions = transactions.clone();
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                observed_transactions.fetch_add(1, Ordering::SeqCst);
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            })),
    );
    let runtime = Unimock::new((
        RuntimeMock::now.some_call(matching!()).returns(now()),
        RuntimeMock::monotonic
            .each_call(matching!())
            .returns(Duration::ZERO)
            .at_least_times(0),
    ));
    let pruner: &dyn Pruner = &service(store, runtime);
    assert_eq!(
        pruner.prune().unwrap(),
        PruneReport {
            links: 1002,
            desktop_grants: 5,
            sessions: 3,
            rate_limits: 4
        }
    );
    assert_eq!(transactions.load(Ordering::SeqCst), 5);
    let calls = calls.lock().unwrap();
    for (table, cutoff, limit) in calls.iter() {
        let days = if ["links", "grants"].contains(table) {
            7
        } else {
            1
        };
        assert_eq!(*cutoff, now() - TimeDelta::days(days));
        assert_eq!(*limit, 1000);
    }
    let mut first_round: Vec<_> = calls[..8].iter().map(|call| call.0).collect();
    first_round.sort();
    assert_eq!(
        first_round,
        [
            "grants", "grants", "links", "links", "rates", "rates", "sessions", "sessions"
        ]
    );
}

#[test]
fn query_failure_aborts_without_returning_partial_counts() {
    let queries = Unimock::new(
        MagicLinksMock::prune_magic_links
            .next_call(matching!(_, _))
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
    let runtime = Unimock::new((
        RuntimeMock::now.some_call(matching!()).returns(now()),
        RuntimeMock::monotonic
            .each_call(matching!())
            .returns(Duration::ZERO)
            .at_least_times(0),
    ));
    assert!(matches!(
        service(store, runtime).prune(),
        Err(Error::Internal(_))
    ));
}
