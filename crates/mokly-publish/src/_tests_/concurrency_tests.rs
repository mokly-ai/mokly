//! In-flight cancellation and bounded scheduling use explicit future gates.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use futures_util::FutureExt;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::exchange::{Client, Exchange};
use crate::http::{HttpMock, Step};
use crate::runtime::{CancellationMock, ClockMock};
use crate::snapshot::Prepared;

use super::support::{active, artifact, clock, missing, plan, reporter, response, settings};

struct InFlight(Arc<AtomicUsize>);
impl Drop for InFlight {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn first_blob_failure_drops_in_flight_requests_and_starts_no_queued_blob() {
    let started = Arc::new(AtomicUsize::new(0));
    let running = Arc::new(AtomicUsize::new(0));
    let failure = Arc::new(Notify::new());
    let missing = missing();
    let fail_digest = missing.iter().next().unwrap().clone();
    let planned = plan(missing);
    let captured = Arc::clone(&started);
    let in_flight = Arc::clone(&running);
    let notify = Arc::clone(&failure);
    let http = Unimock::new((
        HttpMock::send
            .each_call(matching!((request,_) if request.step==Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            }))
            .n_times(1),
        HttpMock::send
            .each_call(matching!((request,_) if request.step==Step::Blob))
            .answers_arc(Arc::new(move |_, request, _| {
                let failed = request.url.path().ends_with(&fail_digest);
                let running = Arc::clone(&in_flight);
                let started = Arc::clone(&captured);
                let notify = Arc::clone(&notify);
                Box::pin(async move {
                    started.fetch_add(1, Ordering::SeqCst);
                    running.fetch_add(1, Ordering::SeqCst);
                    let _guard = InFlight(running);
                    if failed {
                        notify.notified().await;
                        Ok(response(400))
                    } else {
                        std::future::pending().await
                    }
                })
            }))
            .n_times(2),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: reporter(),
    };
    let prepared = Prepared::new(&artifact(false)).unwrap();
    let settings = settings(2);
    let cancellation = active();
    let future = client.publish(&prepared, &settings, &cancellation);
    tokio::pin!(future);
    assert!(future.as_mut().now_or_never().is_none());
    assert_eq!(started.load(Ordering::SeqCst), 2);
    assert_eq!(running.load(Ordering::SeqCst), 2);
    failure.notify_waiters();
    assert!(matches!(future.await, Err(Error::InvalidBundle)));
    assert_eq!(running.load(Ordering::SeqCst), 0);
    assert_eq!(started.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn cancellation_during_a_request_aborts_it_and_never_retries_or_completes() {
    for step in [Step::Plan, Step::Blob, Step::Complete] {
        let cancel = Arc::new(Notify::new());
        let notification = Arc::clone(&cancel);
        let cancellation = Unimock::new((
            mokly_git::command::CancellationMock::is_cancelled
                .each_call(matching!())
                .returns(false),
            CancellationMock::cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let notification = Arc::clone(&notification);
                    Box::pin(async move { notification.notified().await })
                })),
        ));
        let planned = plan(if step == Step::Blob {
            [mokly_model::output::validation::digest(b"one")].into()
        } else {
            Default::default()
        });
        let http = Unimock::new(
            HttpMock::send
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, request, _| {
                    let response = planned.clone();
                    let current = request.step;
                    Box::pin(async move {
                        if current == step {
                            std::future::pending().await
                        } else {
                            assert_eq!(current, Step::Plan);
                            Ok(response)
                        }
                    })
                })),
        );
        let client: &dyn Exchange = &Client {
            http: Arc::new(http),
            clock: if step == Step::Plan {
                Arc::new(Unimock::new(()))
            } else {
                clock()
            },
            reporter: if step == Step::Blob {
                reporter()
            } else {
                Arc::new(Unimock::new(()))
            },
        };
        let prepared = Prepared::new(&artifact(false)).unwrap();
        let settings = settings(2);
        let future = client.publish(&prepared, &settings, &cancellation);
        tokio::pin!(future);
        assert!(future.as_mut().now_or_never().is_none());
        cancel.notify_waiters();
        assert!(matches!(future.await, Err(Error::Cancelled)));
    }
}

#[tokio::test]
async fn cancellation_stops_a_pending_backoff_without_a_second_attempt() {
    let cancel = Arc::new(Notify::new());
    let notification = Arc::clone(&cancel);
    let cancellation = Unimock::new((
        mokly_git::command::CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
        CancellationMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let notification = Arc::clone(&notification);
                Box::pin(async move { notification.notified().await })
            })),
    ));
    let http = Unimock::new(
        HttpMock::send
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(async { Ok(response(503)) })),
    );
    let clock = Unimock::new((
        ClockMock::jitter
            .next_call(matching!(1000))
            .returns(1000_u64),
        ClockMock::sleep
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(std::future::pending())),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: Arc::new(clock),
        reporter: Arc::new(Unimock::new(())),
    };
    let prepared = Prepared::new(&artifact(false)).unwrap();
    let settings = settings(1);
    let future = client.publish(&prepared, &settings, &cancellation);
    tokio::pin!(future);
    assert!(future.as_mut().now_or_never().is_none());
    cancel.notify_waiters();
    assert!(matches!(future.await, Err(Error::Cancelled)));
}

#[tokio::test]
async fn an_already_cancelled_command_starts_no_request() {
    let cancellation = Unimock::new(
        mokly_git::command::CancellationMock::is_cancelled
            .next_call(matching!())
            .returns(true),
    );
    let client: &dyn Exchange = &Client {
        http: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        reporter: Arc::new(Unimock::new(())),
    };
    assert!(matches!(
        client
            .publish(
                &Prepared::new(&artifact(false)).unwrap(),
                &settings(8),
                &cancellation
            )
            .await,
        Err(Error::Cancelled)
    ));
}
