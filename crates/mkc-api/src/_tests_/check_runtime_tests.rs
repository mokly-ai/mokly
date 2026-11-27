//! Independent delivery batches and an injected polling clock with the five-second production pause.

use std::future;
use std::sync::Arc;
use std::time::Duration;

use mkc_publications::build_check_worker::BuildChecksWorkerMock;
use mkc_publications::check_rerequests::CheckRerequestsMock;
use mkc_publications::check_worker::ChecksWorkerMock;
use mkc_publications::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::check_runtime::{
    CheckBatches, CheckClockMock, CheckDelivery, CheckDeliveryMock, CheckWorkerLoop,
};
use crate::github_runtime::WorkerLoop;
use crate::worker_intervals::WorkerIntervals;

#[test]
fn each_tick_runs_both_batches_even_when_either_batch_fails() {
    for (publication_ok, rerequest_ok) in
        [(true, true), (false, true), (true, false), (false, false)]
    {
        let publications = Unimock::new(
            ChecksWorkerMock::run_batch
                .next_call(matching!(None))
                .returns(if publication_ok {
                    Ok(100)
                } else {
                    Err(Error::Unavailable)
                }),
        );
        let rerequests = Unimock::new(
            CheckRerequestsMock::run_batch
                .next_call(matching!())
                .returns(if rerequest_ok {
                    Ok(100)
                } else {
                    Err(Error::Unavailable)
                }),
        );
        let batches: &dyn CheckDelivery = &CheckBatches {
            publications: Arc::new(publications),
            rerequests: Arc::new(rerequests),
            builds: Arc::new(Unimock::new(
                BuildChecksWorkerMock::run_batch
                    .some_call(matching!(None))
                    .returns(Ok(0)),
            )),
            build_rerequests: Arc::new(Unimock::new(
                CheckRerequestsMock::run_batch
                    .some_call(matching!())
                    .returns(Ok(0)),
            )),
        };
        batches.run_once();
    }
}

#[tokio::test]
async fn loop_runs_one_tick_then_waits_for_five_seconds() {
    let worker = Unimock::new(
        CheckDeliveryMock::run_once
            .next_call(matching!())
            .returns(()),
    );
    let clock = Unimock::new(CheckClockMock::sleep.next_call(matching!(_)).answers(
        &|_, duration| {
            assert_eq!(duration, Duration::from_secs(5));
            Box::pin(future::pending())
        },
    ));
    let worker_loop: &dyn WorkerLoop = &CheckWorkerLoop {
        worker: Some(Arc::new(worker)),
        clock: Arc::new(clock),
        interval: WorkerIntervals::default().check_delivery,
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(100), worker_loop.run())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn unconfigured_loop_never_calls_a_worker_or_clock() {
    let worker_loop: &dyn WorkerLoop = &CheckWorkerLoop {
        worker: None,
        clock: Arc::new(Unimock::new(())),
        interval: WorkerIntervals::default().check_delivery,
    };
    assert!(
        tokio::time::timeout(Duration::from_millis(25), worker_loop.run())
            .await
            .is_err()
    );
}
