//! Re-planning shares one command budget and preserves attempted-byte accounting.

use std::collections::BTreeSet;
use std::sync::Arc;

use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::exchange::{Client, Exchange};
use crate::http::{Body, HttpMock, Step, TransportError};
use crate::runtime::{ClockMock, ReporterMock};
use crate::validation::digest;

use super::support::{active, artifact, clock, plan, reporter, response, settings};

#[tokio::test]
async fn a_lost_put_response_still_counts_after_an_expired_plan() {
    let first = plan([digest(b"one")].into());
    let second = plan(BTreeSet::new());
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request,_) if request.step==Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = first.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step==Step::Blob))
            .answers(&|_, _, _| Box::pin(async { Err(TransportError::Failed) })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step==Step::Blob))
            .answers(&|_, _, _| Box::pin(async { Ok(response(410)) })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step==Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = second.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request,_) if request.step==Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
    ));
    let clock = Unimock::new((
        ClockMock::now
            .each_call(matching!())
            .returns(1_790_424_000_000_i64),
        ClockMock::jitter.next_call(matching!(1000)).returns(0_u64),
        ClockMock::sleep
            .next_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(async {})),
    ));
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: Arc::new(clock),
        reporter: reporter(),
    };
    let result = client
        .publish(&artifact(false).prepare().unwrap(), &settings(1), &active())
        .await
        .unwrap();
    assert_eq!(result.uploaded, 3);
    assert_eq!(result.unchanged, 3);
}

#[tokio::test]
async fn local_expiry_uses_one_fresh_plan_then_fails_without_a_blob_attempt() {
    let mut expired = plan([digest(b"one")].into());
    let Body::Bytes(body) = &expired.body else {
        panic!("Plan body")
    };
    let mut document: Value = serde_json::from_slice(body).unwrap();
    document["upload"]["expiresAt"] = Value::String("2026-09-26T11:59:59.000Z".to_owned());
    expired.body = Body::Bytes(serde_json::to_vec(&document).unwrap().into());
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!((request,_) if request.step==Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = expired.clone();
                Box::pin(async { Ok(response) })
            }))
            .n_times(2),
    );
    let events = Arc::new(std::sync::Mutex::new(Vec::new()));
    let captured = Arc::clone(&events);
    let observer = Unimock::new(
        ReporterMock::progress
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, progress| {
                captured.lock().unwrap().push(progress.clone())
            }))
            .n_times(2),
    );
    let client: &dyn Exchange = &Client {
        http: Arc::new(http),
        clock: clock(),
        reporter: Arc::new(observer),
    };
    assert!(matches!(
        client
            .publish(&artifact(false).prepare().unwrap(), &settings(1), &active())
            .await,
        Err(Error::Failed)
    ));
    let events = events.lock().unwrap();
    assert_eq!(events[0].round, 0);
    assert_eq!(events[1].round, 1);
    assert_eq!(events[0].completed, events[1].completed);
    assert_eq!(events[0].total, events[1].total);
}
