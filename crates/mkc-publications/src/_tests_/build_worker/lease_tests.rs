//! Mid-run cancellation, supersession, reclaim and renewal ownership.

use std::future;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_state::BuildState;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::{BuildClaim, BuildLeaseClockMock};
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries, worker};

struct RunDrop(Arc<AtomicBool>);

impl Drop for RunDrop {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn lost_renewal_stops_a_pending_runner_without_any_outcome_write() {
    for _cause in ["superseded", "cancelled", "deleted", "reclaimed", "expired"] {
        let queries = Unimock::new((
            eligibility(
                Some(project()),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            ),
            start_queries(),
            BuildsMock::renew_build
                .some_call(matching!(_, _, _, _))
                .answers(&|_, id, lease, clock, duration| {
                    assert_eq!(id, BUILD);
                    assert_eq!(lease, LEASE);
                    assert_eq!(clock.now(), now());
                    assert_eq!(duration, chrono::Duration::minutes(2));
                    Ok(false)
                }),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(Secret::new("scoped".into()))),
        );
        let entered = Arc::new(Notify::new());
        let stopped = Arc::new(AtomicBool::new(false));
        let runner_entered = entered.clone();
        let runner_stopped = stopped.clone();
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, _, _| {
                let entered = runner_entered.clone();
                let guard = RunDrop(runner_stopped.clone());
                Box::pin(async move {
                    let _guard = guard;
                    entered.notify_one();
                    future::pending().await
                })
            }),
        ));
        let clock = Unimock::new(
            BuildLeaseClockMock::sleep
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, duration| {
                    assert_eq!(duration.as_secs(), 30);
                    let entered = entered.clone();
                    Box::pin(async move { entered.notified().await })
                })),
        );
        let worker = worker(
            queries,
            Arc::new(credentials),
            Arc::new(runner),
            Arc::new(clock),
            4,
        );
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
        assert!(stopped.load(Ordering::SeqCst));
    }
}

#[tokio::test]
async fn cancellation_or_a_new_lease_before_finalization_cannot_be_overwritten() {
    for cancelled in [true, false] {
        let mut running = build(BuildState::Running);
        if cancelled {
            running.state = BuildState::Cancelled;
        } else {
            running.lease_token = Some(uuid::Uuid::nil());
        }
        let queries = Unimock::new((
            eligibility(
                Some(project()),
                Some(repository()),
                Some(installation()),
                Plan::Free,
            ),
            start_queries(),
            BuildsMock::build
                .some_call(matching!(_, _))
                .returns(Ok(Some(running))),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(_, _))
                .returns(Ok(Secret::new("scoped".into()))),
        );
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers(
            &|_, _, _| Box::pin(async { mkc_build_interface::outcome::BuildOutcome::Completed }),
        ));
        let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}
