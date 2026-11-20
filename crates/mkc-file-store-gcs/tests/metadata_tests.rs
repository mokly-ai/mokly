//! Conditional-create metadata confirmation through the injected HTTP seam.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use bytes::Bytes;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_gcs::deadline::ClockMock;
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{HttpMock, Request, Response};
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::store::FileStore;
use reqwest::Method;
use unimock::{MockFn, Unimock, matching};

struct RecordedRequest {
    method: Method,
    url: String,
    body: Option<Bytes>,
    response_limit: u64,
    timeout: Duration,
}

fn deadline() -> OperationDeadline {
    OperationDeadline::new(Duration::from_secs(60))
}

fn key(bytes: &[u8]) -> BlobKey {
    BlobKey {
        hash: BlobHash::digest(bytes),
        incarnation: "00000000-0000-7000-8000-000000000001".parse().unwrap(),
    }
}

fn store(responses: Vec<Response>) -> (GcsFileStore, Arc<Mutex<Vec<RecordedRequest>>>) {
    let count = responses.len();
    let responses = Arc::new(Mutex::new(VecDeque::from(responses)));
    let requests = Arc::new(Mutex::new(Vec::new()));
    let response_queue = responses.clone();
    let request_log = requests.clone();
    let http = Unimock::new(
        HttpMock::execute
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: Request| {
                request_log.lock().unwrap().push(RecordedRequest {
                    method: request.method,
                    url: request.url,
                    body: request.body,
                    response_limit: request.response_limit,
                    timeout: request.timeout,
                });
                Ok(response_queue.lock().unwrap().pop_front().unwrap())
            }))
            .n_times(count),
    );
    (
        GcsFileStore::new(
            "https://storage.googleapis.test".to_owned(),
            "catalogue-fixture".to_owned(),
            None,
            Arc::new(http),
        ),
        requests,
    )
}

fn precondition() -> Response {
    Response {
        status: 412,
        body: include_bytes!("../fixtures/precondition.json").to_vec(),
    }
}

fn metadata(status: u16, body: &[u8]) -> Response {
    Response {
        status,
        body: body.to_vec(),
    }
}

#[test]
fn put_preserves_the_callers_shared_buffer() {
    let bytes = Bytes::from_static(b"published catalogue");
    let expected_pointer = bytes.as_ptr() as usize;
    let expected_length = bytes.len();
    let key = key(&bytes);
    let http = Unimock::new(
        HttpMock::execute
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: Request| {
                let body = request.body.as_ref().unwrap();
                assert_eq!(body.as_ptr() as usize, expected_pointer);
                assert_eq!(body.len(), expected_length);
                Ok(Response {
                    status: 200,
                    body: Vec::new(),
                })
            })),
    );
    let store = GcsFileStore::new(
        "https://storage.googleapis.test".to_owned(),
        "catalogue-fixture".to_owned(),
        None,
        Arc::new(http),
    );

    store.put(&key, bytes, deadline()).unwrap();
}

#[test]
fn matching_metadata_size_confirms_without_downloading_the_body() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let (store, requests) = store(vec![precondition(), metadata(200, br#"{"size":"19"}"#)]);

    store
        .put(&key, Bytes::from_static(bytes), deadline())
        .unwrap();

    let requests = requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].method, Method::POST);
    assert_eq!(requests[0].body.as_deref(), Some(bytes.as_slice()));
    assert_eq!(requests[1].method, Method::GET);
    assert!(requests[1].url.ends_with("?fields=size"));
    assert!(!requests[1].url.contains("alt=media"));
    assert!(requests[1].body.is_none());
    assert_eq!(requests[1].response_limit, 64 * 1024);
    assert!(requests[0].timeout <= Duration::from_secs(60));
    assert!(requests[1].timeout <= requests[0].timeout);
}

#[test]
fn mismatching_metadata_size_is_an_internal_failure() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let (store, _) = store(vec![precondition(), metadata(200, br#"{"size":"20"}"#)]);

    assert!(
        store
            .put(&key, Bytes::from_static(bytes), deadline())
            .is_err()
    );
}

#[test]
fn missing_object_after_precondition_is_an_internal_failure() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let (store, _) = store(vec![
        precondition(),
        metadata(404, include_bytes!("../fixtures/not-found.json")),
    ]);

    assert!(
        store
            .put(&key, Bytes::from_static(bytes), deadline())
            .is_err()
    );
}

#[test]
fn duplicate_confirmation_receives_only_the_remaining_operation_budget() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let now = Arc::new(Mutex::new(Instant::now()));
    let observed = now.clone();
    let clock = Unimock::new(
        ClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| *observed.lock().unwrap())),
    );
    let elapsed = now.clone();
    let timeouts = Arc::new(Mutex::new(Vec::new()));
    let recorded = timeouts.clone();
    let calls = Arc::new(Mutex::new(0));
    let call_count = calls.clone();
    let http = Unimock::new(
        HttpMock::execute
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: Request| {
                recorded.lock().unwrap().push(request.timeout);
                let mut count = call_count.lock().unwrap();
                *count += 1;
                if *count == 1 {
                    *elapsed.lock().unwrap() += Duration::from_secs(52);
                    Ok(precondition())
                } else {
                    Ok(metadata(200, br#"{"size":"19"}"#))
                }
            }))
            .n_times(2),
    );
    let store = GcsFileStore::with_clock(
        "https://storage.googleapis.test".to_owned(),
        "catalogue-fixture".to_owned(),
        None,
        Arc::new(http),
        Arc::new(clock),
    );

    store
        .put(&key, Bytes::from_static(bytes), deadline())
        .unwrap();

    assert_eq!(
        *timeouts.lock().unwrap(),
        [Duration::from_secs(60), Duration::from_secs(8)]
    );
}

#[test]
fn exhausted_insert_budget_sends_no_confirmation_request() {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let now = Arc::new(Mutex::new(Instant::now()));
    let observed = now.clone();
    let clock = Unimock::new(
        ClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| *observed.lock().unwrap())),
    );
    let elapsed = now.clone();
    let http = Unimock::new(
        HttpMock::execute
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _: Request| {
                *elapsed.lock().unwrap() += Duration::from_secs(60);
                Ok(precondition())
            })),
    );
    let store = GcsFileStore::with_clock(
        "https://storage.googleapis.test".to_owned(),
        "catalogue-fixture".to_owned(),
        None,
        Arc::new(http),
        Arc::new(clock),
    );

    assert!(
        store
            .put(&key, Bytes::from_static(bytes), deadline())
            .is_err()
    );
}
