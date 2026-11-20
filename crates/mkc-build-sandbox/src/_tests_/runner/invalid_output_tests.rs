//! Invalid process bytes and later diagnostics reach the log sink unchanged.

use mkc_build_interface::log::{BuildStream, MAX_CHUNK_BYTES};
use mkc_build_interface::outcome::BuildOutcome;
use sandbox_interface::ProcessStreamEvent;

use super::fixtures::request;
use super::script::complete;
use super::support::Harness;

#[tokio::test]
async fn invalid_runs_in_both_streams_preserve_the_diagnostic_in_full() {
    let mut calls = complete();
    let mut bytes = vec![0x80; 65_537];
    bytes.extend_from_slice(b"\ndiagnostic after invalid bytes\n");
    calls[0]
        .events
        .insert(1, ProcessStreamEvent::Stdout(bytes.clone()));
    calls[0]
        .events
        .insert(2, ProcessStreamEvent::Stderr(bytes.clone()));
    let harness = Harness::new(request(), calls);
    assert!(matches!(harness.run().await, BuildOutcome::Completed));
    let chunks = harness.chunks.lock().unwrap();
    assert!(
        chunks
            .iter()
            .all(|chunk| !chunk.bytes.is_empty() && chunk.bytes.len() <= MAX_CHUNK_BYTES)
    );
    for stream in [BuildStream::Stdout, BuildStream::Stderr] {
        let actual: Vec<_> = chunks
            .iter()
            .filter(|chunk| chunk.stream == stream)
            .flat_map(|chunk| chunk.bytes.clone())
            .collect();
        assert_eq!(actual, bytes);
    }
}
