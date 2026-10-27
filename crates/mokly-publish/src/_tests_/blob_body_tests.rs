//! Deterministic gzip body preparation tests.

use std::io::Read;

use bytes::Bytes;
use flate2::read::GzDecoder;
use unimock::{MockFn, Unimock, matching};

use crate::blob_body::{encode, prepare};
use crate::error::Error;
use crate::http::Encoding;
use crate::runtime::CancellationMock;

use super::support::seeded_bytes;

#[test]
fn compressible_bytes_are_gzip_and_decode_exactly() {
    let input = Bytes::from(vec![b'a'; 4096]);
    let (body, encoding) = encode(&input).unwrap();
    assert_eq!(encoding, Encoding::Gzip);
    assert!(body.len() < input.len());
    let mut decoded = Vec::new();
    GzDecoder::new(body.as_ref())
        .read_to_end(&mut decoded)
        .unwrap();
    assert_eq!(decoded, input);
    let second = encode(&input).unwrap();
    assert_eq!((body, encoding), second);
}

#[test]
fn incompressible_empty_and_tiny_bytes_stay_identity() {
    for input in [seeded_bytes(4096), Bytes::new(), Bytes::from_static(b"x")] {
        let (body, encoding) = encode(&input).unwrap();
        assert_eq!(encoding, Encoding::Identity);
        assert_eq!(body, input);
    }
}

#[tokio::test]
async fn identity_does_not_start_a_blocking_encoding_task() {
    let input = Bytes::from_static(b"raw");
    let (body, encoding) = prepare(input.clone(), Encoding::Identity, &Unimock::new(()))
        .await
        .unwrap();
    assert_eq!(body, input);
    assert_eq!(encoding, Encoding::Identity);
}

#[tokio::test]
async fn ready_cancellation_stops_a_pending_gzip_task() {
    let cancellation = Unimock::new(
        CancellationMock::cancelled
            .each_call(matching!())
            .answers(&|_| Box::pin(async {})),
    );
    let result = prepare(
        Bytes::from(vec![b'a'; 4 * 1024 * 1024]),
        Encoding::Gzip,
        &cancellation,
    )
    .await;
    assert!(matches!(result, Err(Error::Cancelled)));
}
