//! A successful renewal keeps execution alive until a later fence loss.

use std::future;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::{BuildClaim, BuildLeaseClockMock};
use crate::tests::build_fixtures::*;

use super::support::{start_queries, worker};

struct RunDrop(Arc<AtomicBool>);

impl Drop for RunDrop {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn live_renewal_continues_and_the_next_lost_renewal_drops_execution() {
    let renewals = Arc::new(AtomicUsize::new(0));
    let count = renewals.clone();
    let queries = Unimock::new((
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        start_queries(),
        BuildsMock::renew_build
            .each_call(matching!(_, _, _, _))
            .answers_arc(Arc::new(move |_, id, lease, clock, duration| {
                assert_eq!((id, lease), (BUILD, LEASE));
                assert_eq!(clock.now(), now());
                assert_eq!(duration, chrono::Duration::minutes(2));
                Ok(count.fetch_add(1, Ordering::SeqCst) == 0)
            }))
            .n_times(2),
    ));
    let entered = Arc::new(Notify::new());
    let runner_entered = entered.clone();
    let stopped = Arc::new(AtomicBool::new(false));
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
    let waits = AtomicUsize::new(0);
    let clock = Unimock::new(
        BuildLeaseClockMock::sleep
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, duration| {
                assert_eq!(duration.as_secs(), 30);
                let entered = entered.clone();
                let first = waits.fetch_add(1, Ordering::SeqCst) == 0;
                Box::pin(async move {
                    if first {
                        entered.notified().await;
                    }
                })
            }))
            .n_times(2),
    );
    let credentials = Unimock::new(
        TokensMock::repository_read
            .some_call(matching!(1, 100))
            .returns(Ok(Secret::new("scoped".into()))),
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
    assert_eq!(renewals.load(Ordering::SeqCst), 2);
    assert!(stopped.load(Ordering::SeqCst));
}
