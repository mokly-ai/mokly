//! Cleanup observes one clock and returns only committed retry results.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io;
use std::sync::Arc;
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

fn now() -> DateTime<Utc> {
    "2026-09-17T12:00:00Z".parse().unwrap()
}

fn service(store: Unimock) -> AuthPruner {
    AuthPruner {
        store: Arc::new(store),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now.next_call(matching!()).returns(now()),
        )),
        retention: Retention {
            links: Duration::from_secs(604_800),
            sessions: Duration::from_secs(86_400),
            rate_limits: Duration::from_secs(86_400),
        },
    }
}

#[test]
fn cutoffs_and_counts_are_stable_across_transaction_retries() {
    let queries = Unimock::new((
        MagicLinksMock::prune_magic_links.each_call(matching!((cutoff) if *cutoff == now() - TimeDelta::days(7))).answers(&|_, _| Ok(2)).n_times(2),
        DesktopGrantsMock::prune_desktop_grants.each_call(matching!((cutoff) if *cutoff == now() - TimeDelta::days(7))).answers(&|_, _| Ok(5)).n_times(2),
        SessionsMock::prune_sessions.each_call(matching!((expiry, seen) if *expiry == now() - TimeDelta::days(1) && *seen == now() - TimeDelta::days(8))).answers(&|_, _, _| Ok(3)).n_times(2),
        RateLimitsMock::prune_rate_limits.each_call(matching!((cutoff) if *cutoff == now() - TimeDelta::days(1))).answers(&|_, _| Ok(4)).n_times(2),
    ));
    let store = Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            })),
    );
    let pruner: &dyn Pruner = &service(store);
    assert_eq!(
        pruner.prune().unwrap(),
        PruneReport {
            links: 2,
            desktop_grants: 5,
            sessions: 3,
            rate_limits: 4
        }
    );
}

#[test]
fn query_failure_aborts_without_returning_partial_counts() {
    let queries = Unimock::new(
        MagicLinksMock::prune_magic_links
            .next_call(matching!(_))
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
    assert!(matches!(service(store).prune(), Err(Error::Internal(_))));
}
