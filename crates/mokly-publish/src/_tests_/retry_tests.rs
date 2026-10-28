//! Retry timing uses an injected fake clock and no elapsed-time assertions.

use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Duration;

use bytes::Bytes;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::http::{Encoding, HttpMock, Request, Step, TransportError};
use crate::retry::{Requests, retry_after_seconds};
use crate::runtime::{ClockMock, Timer};

use super::support::{active, response, settings};

fn request(step: Step) -> Request {
    Request {
        step,
        url: settings(1).endpoint,
        body: Bytes::new(),
        encoding: Encoding::Identity,
        timeout: Duration::from_secs(120),
    }
}

#[tokio::test]
async fn all_retryable_statuses_and_transport_failures_use_five_attempts_and_full_jitter() {
    for step in [Step::Plan, Step::Blob, Step::Complete] {
        for status in [0, 408, 429, 500, 502, 503, 504] {
            let http = Unimock::new(
                HttpMock::send
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, request, _| {
                        assert_eq!(request.timeout, Duration::from_secs(120));
                        Box::pin(async move {
                            if status == 0 {
                                Err(TransportError::Failed)
                            } else {
                                Ok(response(status))
                            }
                        })
                    }))
                    .n_times(5),
            );
            let now = Arc::new(AtomicI64::new(100_000));
            let time = Arc::clone(&now);
            let waited = Arc::new(std::sync::Mutex::new(Vec::new()));
            let captured = Arc::clone(&waited);
            let clock = Unimock::new((
                ClockMock::now
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| time.load(Ordering::SeqCst))),
                ClockMock::jitter
                    .each_call(matching!(_))
                    .answers(&|_, maximum| maximum),
                ClockMock::sleep
                    .each_call(matching!(Timer::Backoff, _))
                    .answers_arc(Arc::new(move |_, _, delay| {
                        captured.lock().unwrap().push(delay);
                        let now = Arc::clone(&now);
                        Box::pin(async move {
                            now.fetch_add(delay.as_millis() as i64, Ordering::SeqCst);
                        })
                    }))
                    .n_times(4),
            ));
            let settings = settings(1);
            let cancellation = active();
            let requests = Requests {
                http: &http,
                clock: &clock,
                settings: &settings,
                cancellation: &cancellation,
            };
            assert!(matches!(
                requests.send(&request(step), Some(1_000_000), None).await,
                Err(Error::Transport)
            ));
            assert_eq!(
                *waited.lock().unwrap(),
                [1, 2, 4, 8].map(Duration::from_secs)
            );
        }
    }
}

#[tokio::test]
async fn integer_retry_after_overrides_jitter_and_success_stops_the_sequence() {
    for value in ["0", "1", "60", "0002"] {
        let mut retried = response(503);
        retried.retry_after = Some(value.to_owned());
        let http = Unimock::new((
            HttpMock::send
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    let response = retried.clone();
                    Box::pin(async { Ok(response) })
                })),
            HttpMock::send
                .next_call(matching!(_, _))
                .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
        ));
        let delay = Duration::from_secs(value.parse::<u64>().unwrap());
        let clock = Unimock::new(ClockMock::sleep.next_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, _, actual| {
                assert_eq!(actual, delay);
                Box::pin(async {})
            }),
        ));
        let settings = settings(1);
        let cancellation = active();
        let requests = Requests {
            http: &http,
            clock: &clock,
            settings: &settings,
            cancellation: &cancellation,
        };
        assert_eq!(
            requests
                .send(&request(Step::Complete), None, None)
                .await
                .unwrap()
                .status,
            201
        );
    }
    for value in [
        "",
        "-1",
        "+1",
        "1.0",
        "61",
        " 1",
        "1 ",
        "Wed, 21 Oct 2015 07:28:00 GMT",
        "9999999999999999999999",
    ] {
        assert_eq!(retry_after_seconds(value), None, "{value}");
    }
}

#[tokio::test]
async fn attempt_deadlines_and_waits_stop_at_expiry_without_starting_another_request() {
    let settings = settings(1);
    let cancellation = active();
    let http = Unimock::new(
        HttpMock::send
            .next_call(matching!((request,_) if request.timeout==Duration::from_millis(500)))
            .answers(&|_, _, _| {
                let mut response = response(503);
                response.retry_after = Some("1".to_owned());
                Box::pin(async { Ok(response) })
            }),
    );
    let clock = Unimock::new(ClockMock::now.each_call(matching!()).returns(1000_i64));
    let requests = Requests {
        http: &http,
        clock: &clock,
        settings: &settings,
        cancellation: &cancellation,
    };
    assert!(matches!(
        requests.send(&request(Step::Blob), Some(1500), None).await,
        Err(Error::Replan)
    ));
    let http = Unimock::new(());
    let requests = Requests {
        http: &http,
        clock: &clock,
        settings: &settings,
        cancellation: &cancellation,
    };
    for expiry in [999, 1000] {
        assert!(matches!(
            requests
                .send(&request(Step::Complete), Some(expiry), None)
                .await,
            Err(Error::Replan)
        ));
    }
    let http = Unimock::new(
        HttpMock::send
            .next_call(matching!(_, _))
            .answers(&|_, _, _| {
                let mut response = response(503);
                response.retry_after = Some("1".to_owned());
                Box::pin(async { Ok(response) })
            }),
    );
    let requests = Requests {
        http: &http,
        clock: &clock,
        settings: &settings,
        cancellation: &cancellation,
    };
    assert!(matches!(
        requests.send(&request(Step::Blob), Some(2000), None).await,
        Err(Error::Replan)
    ));
}

#[tokio::test]
async fn unreadable_plan_body_retries_but_known_completion_never_does() {
    let mut unreadable = response(200);
    unreadable.body = crate::http::Body::Unreadable;
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = unreadable.clone();
                Box::pin(async { Ok(response) })
            }))
            .n_times(5),
    );
    let settings = settings(1);
    let cancellation = active();
    let clock = Arc::new(Unimock::new((
        ClockMock::jitter.each_call(matching!(_)).returns(0_u64),
        ClockMock::sleep
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(async {})),
    )));
    let requests = Requests {
        http: &http,
        clock: clock.as_ref(),
        settings: &settings,
        cancellation: &cancellation,
    };
    assert!(matches!(
        requests.send(&request(Step::Plan), None, None).await,
        Err(Error::Transport)
    ));
    for body in [crate::http::Body::Unreadable, crate::http::Body::Oversized] {
        let mut success = response(201);
        success.body = body;
        let http = Unimock::new(
            HttpMock::send
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    let response = success.clone();
                    Box::pin(async { Ok(response) })
                })),
        );
        let clock = Unimock::new(());
        let requests = Requests {
            http: &http,
            clock: &clock,
            settings: &settings,
            cancellation: &cancellation,
        };
        assert_eq!(
            requests
                .send(&request(Step::Complete), None, None)
                .await
                .unwrap()
                .status,
            201
        );
    }
}
