//! Raw fallback tests for unusable and incompressible gzip offers.

use std::sync::{Arc, Mutex};

use bytes::Bytes;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::exchange::Exchange;
use crate::http::{Encoding, HttpMock, Step};

use super::gzip_exchange_tests::{client, plan_response, prepared_with_file};
use super::support::{active, response, settings};

async fn send_one(encodings: Option<serde_json::Value>, bytes: Bytes) -> (Bytes, Encoding) {
    let prepared = prepared_with_file("static/blob.bin", bytes);
    let digest = prepared
        .ownership
        .files
        .iter()
        .find(|entry| entry.path == "static/blob.bin")
        .unwrap()
        .sha256
        .clone();
    let planned = plan_response(&digest, encodings);
    let captured = Arc::new(Mutex::new(None));
    let observed = Arc::clone(&captured);
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
                *observed.lock().unwrap() = Some((request.body.clone(), request.encoding));
                Box::pin(async { Ok(response(204)) })
            })),
        HttpMock::send
            .next_call(matching!((request, _) if request.step == Step::Complete))
            .answers(&|_, _, _| Box::pin(async { Ok(response(201)) })),
    ));
    client(http, super::support::reporter(), super::support::clock())
        .publish(&prepared, &settings(1), &active())
        .await
        .unwrap();
    captured.lock().unwrap().take().unwrap()
}

#[tokio::test]
async fn unusable_plan_encoding_stays_raw_for_compressible_bytes() {
    let bytes = Bytes::from(vec![b'a'; 8192]);
    for encodings in [
        Some(json!("gzip")),
        Some(json!(["br"])),
        Some(json!(null)),
        None,
    ] {
        assert_eq!(
            send_one(encodings, bytes.clone()).await,
            (bytes.clone(), Encoding::Identity)
        );
    }
}

#[tokio::test]
async fn a_gzip_plan_keeps_incompressible_bytes_raw() {
    let mut value = 0x1234_5678_u32;
    let mut bytes = Vec::with_capacity(8192);
    while bytes.len() < 8192 {
        value ^= value << 13;
        value ^= value >> 17;
        value ^= value << 5;
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes.truncate(8192);
    let bytes: Bytes = bytes.into();
    assert_eq!(
        send_one(Some(json!(["gzip"])), bytes.clone()).await,
        (bytes, Encoding::Identity)
    );
}
