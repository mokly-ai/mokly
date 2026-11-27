//! Integrity, backpressure, cancellation and blocking-pool isolation.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use bytes::Bytes;
use futures_util::stream;
use http_body_util::BodyExt;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::stream::{BlobBody, BlobStream};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::{ExchangeMock, FileBody, FileFraming, ServeMock, Served};
use crate::test_support::{ID, body, locations};

use super::router;

const CHUNK_BYTES: usize = 64 * 1024;

fn key(bytes: &[u8]) -> BlobKey {
    BlobKey::from_object_name(&format!(
        "sha256/{}/00000000-0000-7000-8000-000000000001",
        BlobHash::digest(bytes)
    ))
    .unwrap()
}

#[tokio::test]
async fn mismatched_full_stream_aborts_before_the_final_byte() {
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers(&|_, _, _| {
        Ok(Served::File {
            status: 200,
            body: Some(FileBody::Ready(
                BlobStream::full(&key(b"good"), 4, body(b"evil".to_vec())).unwrap(),
            )),
            framing: FileFraming::Full(4),
            content_type: "text/plain".into(),
            cache: "no-cache",
            etag: "W/\"hash\"".into(),
            access_worker: false,
        })
    }));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/corrupt.txt")
                .header("Host", locations().authority(ID))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let mut body = response.into_body();
    let mut received = Vec::new();
    let mut failed = false;
    while let Some(frame) = body.frame().await {
        match frame {
            Ok(frame) => {
                if let Ok(data) = frame.into_data() {
                    received.extend_from_slice(&data);
                }
            }
            Err(_) => {
                failed = true;
                break;
            }
        }
    }
    assert!(failed);
    assert_eq!(received, b"evi");
}

fn observed_body(bytes: Arc<Vec<u8>>, polls: Arc<AtomicUsize>) -> BlobBody {
    Box::pin(stream::unfold(0, move |position| {
        let bytes = bytes.clone();
        let polls = polls.clone();
        async move {
            if position == bytes.len() {
                return None;
            }
            polls.fetch_add(1, Ordering::SeqCst);
            let end = (position + CHUNK_BYTES).min(bytes.len());
            Some((Ok(Bytes::copy_from_slice(&bytes[position..end])), end))
        }
    }))
}

#[tokio::test]
async fn response_backpressure_polls_only_as_the_client_reads() {
    let bytes = Arc::new(vec![b'x'; CHUNK_BYTES * 32]);
    let polls = Arc::new(AtomicUsize::new(0));
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc({
        let bytes = bytes.clone();
        let polls = polls.clone();
        Arc::new(move |_, _, _| {
            Ok(Served::File {
                status: 200,
                body: Some(FileBody::Ready(
                    BlobStream::full(
                        &key(&bytes),
                        bytes.len() as u64,
                        observed_body(bytes.clone(), polls.clone()),
                    )
                    .unwrap(),
                )),
                framing: FileFraming::Full(bytes.len() as u64),
                content_type: "application/octet-stream".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
                access_worker: false,
            })
        })
    }));
    let response = router(catalogue)
        .oneshot(
            Request::builder()
                .uri("/large.bin")
                .header("Host", locations().authority(ID))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(polls.load(Ordering::SeqCst), 0);
    let mut body = response.into_body();
    assert!(body.frame().await.is_some());
    let after_frame = polls.load(Ordering::SeqCst);
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(after_frame, 1);
    assert_eq!(polls.load(Ordering::SeqCst), after_frame);
}

struct DropSignal(Arc<AtomicBool>);

impl Drop for DropSignal {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn dropping_an_unread_response_releases_its_storage_stream() {
    let released = Arc::new(AtomicBool::new(false));
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc({
        let released = released.clone();
        Arc::new(move |_, _, _| {
            let stream = stream::unfold(DropSignal(released.clone()), |guard| async move {
                Some((Ok(Bytes::from_static(b"body")), guard))
            });
            Ok(Served::File {
                status: 200,
                body: Some(FileBody::Ready(
                    BlobStream::full(&key(b"body"), 4, Box::pin(stream)).unwrap(),
                )),
                framing: FileFraming::Full(4),
                content_type: "text/plain".into(),
                cache: "no-cache",
                etag: "W/\"hash\"".into(),
                access_worker: false,
            })
        })
    }));
    {
        let _response = router(catalogue)
            .oneshot(
                Request::builder()
                    .uri("/slow.txt")
                    .header("Host", locations().authority(ID))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert!(!released.load(Ordering::SeqCst));
    }
    assert!(released.load(Ordering::SeqCst));
}

#[test]
fn unread_bodies_do_not_starve_file_or_access_requests() {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .max_blocking_threads(2)
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let bytes: Arc<[u8]> = vec![b'x'; CHUNK_BYTES * 16].into();
        let catalogue = Unimock::new((
            ServeMock.each_call(matching!(_, _)).answers_arc({
                let bytes = bytes.clone();
                Arc::new(move |_, _, _| {
                    Ok(super::compression_support::full_file(
                        bytes.clone(),
                        "no-cache",
                    ))
                })
            }),
            ExchangeMock
                .next_call(matching!(_, "grant"))
                .returns(Ok("signed".into())),
        ));
        let service = router(catalogue.clone());
        let mut slow = Vec::new();
        for index in 0..8 {
            slow.push(
                service
                    .clone()
                    .oneshot(
                        Request::builder()
                            .uri(format!("/slow-{index}.json"))
                            .header("Host", locations().authority(ID))
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            );
        }

        // Both requests settle while the test still holds the eight unread
        // responses. A starved request never settles, and the CI job timeout
        // ends the run, so no wall-clock limit decides the result. The router
        // cannot fail, so each request gives its response.
        let Ok(ordinary) = service
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/ordinary.json")
                    .header("Host", locations().authority(ID))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await;
        let Ok(access) = service
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/_access")
                    .header("Host", locations().authority(ID))
                    .header("Origin", "https://app.example.com")
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"grant":"grant"}"#))
                    .unwrap(),
            )
            .await;
        assert_eq!(
            ordinary.status(),
            StatusCode::OK,
            "ordinary file request beside unread responses"
        );
        assert_eq!(
            access.status(),
            StatusCode::OK,
            "access exchange beside unread responses"
        );
        assert_eq!(slow.len(), 8);
        for response in slow {
            let frame = response.into_body().frame().await;
            assert!(
                matches!(&frame, Some(Ok(frame)) if frame.is_data()),
                "each held response must stay open and unread: {frame:?}"
            );
        }
    });
}
