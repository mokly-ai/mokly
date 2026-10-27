//! Re-plan tests for changing and repeating the Blob encoding offer.

use std::sync::{Arc, Mutex};

use bytes::Bytes;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::exchange::Exchange;
use crate::http::{Encoding, HttpMock, Step};
use crate::snapshot::Prepared;

use super::support::{
    active, client, digest_for, plan_with_encoding, prepared_with_file, response, settings,
};

async fn run(second_encoding: Option<serde_json::Value>) -> (Vec<(Bytes, Encoding)>, Bytes) {
    let file: Bytes = vec![b'z'; 8192].into();
    let prepared: Prepared = prepared_with_file("static/replan.bin", file.clone());
    let digest = digest_for(&prepared, "static/replan.bin");
    let plans = Arc::new(Mutex::new(vec![
        plan_with_encoding([digest.clone()].into(), Some(json!(["gzip"]))),
        plan_with_encoding([digest].into(), second_encoding),
    ]));
    let completions = Arc::new(Mutex::new(0));
    let bodies = Arc::new(Mutex::new(Vec::new()));
    let captured_bodies = Arc::clone(&bodies);
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if request.step == Step::Plan {
                    let response = plans.lock().unwrap().remove(0);
                    Box::pin(async move { Ok(response) })
                } else if request.step == Step::Blob {
                    captured_bodies
                        .lock()
                        .unwrap()
                        .push((request.body.clone(), request.encoding));
                    Box::pin(async { Ok(response(204)) })
                } else {
                    let mut completions = completions.lock().unwrap();
                    *completions += 1;
                    let status = if *completions == 1 { 409 } else { 201 };
                    Box::pin(async move { Ok(response(status)) })
                }
            })),
    );
    client(http, super::support::reporter(), super::support::clock())
        .publish(&prepared, &settings(1), &active())
        .await
        .unwrap();
    (Arc::try_unwrap(bodies).unwrap().into_inner().unwrap(), file)
}

#[tokio::test]
async fn a_replan_without_gzip_sends_raw_bytes_after_a_gzip_round() {
    let (bodies, file) = run(None).await;
    assert_eq!(bodies.len(), 2);
    assert_eq!(bodies[0].1, Encoding::Gzip);
    assert_eq!(bodies[1], (file, Encoding::Identity));
}

#[tokio::test]
async fn two_gzip_rounds_send_equal_bodies() {
    let (bodies, _) = run(Some(json!(["gzip"]))).await;
    assert_eq!(bodies.len(), 2);
    assert_eq!(bodies[0].1, Encoding::Gzip);
    assert_eq!(bodies[0], bodies[1]);
}
