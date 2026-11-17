//! Opt-in release-mode compression timing proof, built only with the
//! `compression-benchmark` feature.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::{Body, to_bytes};
use axum::http::Request;
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::catalogue::ServeMock;
use crate::test_support::{ID, locations};

use super::compression_support::{full_file, representative_catalogue_json};
use super::router;

#[tokio::test(flavor = "current_thread")]
async fn representative_five_mib_catalogue_brotli_benchmark() {
    let bytes = representative_catalogue_json();
    let served = bytes.clone();
    let catalogue = Unimock::new(ServeMock.next_call(matching!(_, _)).answers_arc(Arc::new(
        move |_, _, _| Ok(full_file(served.clone(), "no-cache")),
    )));
    let service = router(catalogue);
    let started = Instant::now();
    let response = service
        .oneshot(
            Request::builder()
                .uri("/mokly-viewer/catalogue.json")
                .header("Host", locations().authority(ID))
                .header("Accept-Encoding", "br")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["content-encoding"], "br");
    let compressed = to_bytes(response.into_body(), bytes.len() * 2)
        .await
        .unwrap();
    let elapsed = started.elapsed();
    let ratio = bytes.len() as f64 / compressed.len() as f64;
    eprintln!(
        "compressed {} fixture-derived JSON bytes to {} bytes ({ratio:.2}:1) in {elapsed:?}",
        bytes.len(),
        compressed.len()
    );
    assert!(elapsed < Duration::from_secs(1), "elapsed: {elapsed:?}");
}
