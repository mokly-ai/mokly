//! Gzip Blob exchange tests with captured requests and fake timing.

use std::io::Read;
use std::sync::{Arc, Mutex};

use flate2::read::GzDecoder;
use mokly_model::output::validation::digest;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::accounting::Progress;
use crate::completion::Outcome;
use crate::error::Error;
use crate::exchange::Exchange;
use crate::http::{Encoding, HttpMock, Step};
use crate::runtime::{CancellationMock, ClockMock, ReporterMock};

use super::support::{
    active, client, digest_for, plan_with_encoding, prepared_with_file, response, settings,
};

fn clock_with_retry() -> Unimock {
    Unimock::new((
        ClockMock::now
            .each_call(matching!())
            .returns(1_790_424_000_000_i64),
        ClockMock::jitter.each_call(matching!(_)).returns(0_u64),
        ClockMock::sleep
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Box::pin(async {})),
    ))
}

#[tokio::test]
async fn gzip_blob_is_smaller_decodes_and_counts_decoded_bytes() {
    let prepared = prepared_with_file("static/compressible.bin", vec![b'a'; 8192].into());
    let expected_digest = digest_for(&prepared, "static/compressible.bin");
    let captured = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&captured);
    let planned = plan_with_encoding([expected_digest.clone()].into(), Some(json!(["gzip"])));
    let http = Unimock::new((
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Blob))
            .answers_arc(Arc::new(move |_, request, _| {
                observed
                    .lock()
                    .unwrap()
                    .push((request.body.clone(), request.encoding));
                Box::pin(async { Ok(response(204)) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
    ));
    let progress = Arc::new(Mutex::new(Vec::<Progress>::new()));
    let observed_progress = Arc::clone(&progress);
    let reporter = Unimock::new(ReporterMock::progress.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, value| observed_progress.lock().unwrap().push(value.clone())),
    ));
    let result = client(http, Arc::new(reporter), super::support::clock())
        .publish(&prepared, &settings(1), &active())
        .await
        .unwrap();
    let captured = captured.lock().unwrap();
    assert_eq!(captured.len(), 1);
    assert_eq!(captured[0].1, Encoding::Gzip);
    assert!(captured[0].0.len() < 8192);
    let mut decoded = Vec::new();
    GzDecoder::new(captured[0].0.as_ref())
        .read_to_end(&mut decoded)
        .unwrap();
    assert_eq!(digest(&decoded), expected_digest);
    assert_eq!(result.completion.outcome, Outcome::Published);
    let expected_size = prepared
        .plan_files
        .iter()
        .map(|file| file.bytes.len() as u64)
        .sum::<u64>()
        + 8192;
    assert_eq!(progress.lock().unwrap()[0].size, expected_size);
}

#[tokio::test]
async fn retry_reuses_the_same_gzip_body_and_encoding() {
    let prepared = prepared_with_file("static/retry.bin", vec![b'b'; 8192].into());
    let digest = digest_for(&prepared, "static/retry.bin");
    let planned = plan_with_encoding([digest].into(), Some(json!(["gzip"])));
    let captured = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&captured);
    let attempts = Arc::new(Mutex::new(0));
    let observed_attempts = Arc::clone(&attempts);
    let http = Unimock::new(
        HttpMock::send
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if request.step == Step::Plan {
                    let response = planned.clone();
                    Box::pin(async move { Ok(response) })
                } else if request.step == Step::Blob {
                    observed
                        .lock()
                        .unwrap()
                        .push((request.body.clone(), request.encoding));
                    let mut attempts = observed_attempts.lock().unwrap();
                    *attempts += 1;
                    let status = if *attempts == 1 { 503 } else { 204 };
                    Box::pin(async move { Ok(response(status)) })
                } else {
                    Box::pin(async { Ok(response(201)) })
                }
            })),
    );
    client(
        http,
        super::support::reporter(),
        Arc::new(clock_with_retry()),
    )
    .publish(&prepared, &settings(1), &active())
    .await
    .unwrap();
    let captured = captured.lock().unwrap();
    assert_eq!(captured.len(), 2);
    assert!(
        captured
            .iter()
            .all(|(_, encoding)| *encoding == Encoding::Gzip)
    );
    assert!(captured.iter().all(|(body, _)| body.len() < 8192));
    assert_eq!(captured[0], captured[1]);
}

#[tokio::test]
async fn ready_cancellation_during_gzip_sends_no_blob_request() {
    let prepared = prepared_with_file("static/cancel.bin", vec![b'c'; 8192].into());
    let digest = digest_for(&prepared, "static/cancel.bin");
    let planned = plan_with_encoding([digest].into(), Some(json!(["gzip"])));
    let http = Unimock::new(
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Plan))
            .answers_arc(Arc::new(move |_, _, _| {
                let response = planned.clone();
                Box::pin(async { Ok(response) })
            })),
    );
    let cancellation = Unimock::new((
        mokly_git::command::CancellationMock::is_cancelled
            .each_call(matching!())
            .returns(false),
        CancellationMock::cancelled
            .each_call(matching!())
            .answers(&|_| Box::pin(async {})),
    ));
    let result = client(http, super::support::reporter(), Arc::new(Unimock::new(())))
        .publish(&prepared, &settings(1), &cancellation)
        .await;
    assert!(matches!(result, Err(Error::Cancelled)));
}
