//! Build loops use documented waits and remain idle without configuration.

use std::future;
use std::sync::Arc;
use std::time::Duration;

use mkc_publications::build_reconciliation::BuildReconcilerMock;
use mkc_publications::build_worker::service::{BuildClaim, BuildWorkerMock};
use unimock::{MockFn, Unimock, matching};

use crate::build_runtime::{BuildReconciliationLoop, BuildWorkerLoop};
use crate::check_runtime::CheckClockMock;
use crate::github_runtime::WorkerLoop;
use crate::worker_intervals::WorkerIntervals;

#[tokio::test]
async fn idle_build_loop_waits_two_seconds() {
    let worker = Unimock::new(
        BuildWorkerMock::claim
            .some_call(matching!())
            .returns(Ok(BuildClaim::Idle)),
    );
    let clock = Unimock::new(CheckClockMock::sleep.some_call(matching!(_)).answers(
        &|_, duration| {
            assert_eq!(duration, Duration::from_secs(2));
            Box::pin(future::pending())
        },
    ));
    let polling: &dyn WorkerLoop = &BuildWorkerLoop {
        worker: Some(Arc::new(worker)),
        clock: Arc::new(clock),
        interval: WorkerIntervals::default().build_claim,
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(100), polling.run())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn reconciliation_runs_on_each_replica_every_five_minutes() {
    let reconciler = Unimock::new(
        BuildReconcilerMock::reconcile
            .some_call(matching!())
            .returns(Ok(0)),
    );
    let clock = Unimock::new(CheckClockMock::sleep.some_call(matching!(_)).answers(
        &|_, duration| {
            assert_eq!(duration, Duration::from_secs(300));
            Box::pin(future::pending())
        },
    ));
    let polling: &dyn WorkerLoop = &BuildReconciliationLoop {
        reconciler: Some(Arc::new(reconciler)),
        clock: Arc::new(clock),
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(30), polling.run())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn absent_builds_run_neither_loop_nor_clock() {
    let polling: &dyn WorkerLoop = &BuildWorkerLoop {
        worker: None,
        clock: Arc::new(Unimock::new(())),
        interval: WorkerIntervals::default().build_claim,
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(20), polling.run())
            .await
            .is_err()
    );
    let polling: &dyn WorkerLoop = &BuildReconciliationLoop {
        reconciler: None,
        clock: Arc::new(Unimock::new(())),
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(20), polling.run())
            .await
            .is_err()
    );
}
