//! Display-byte limits apply after replacement decoding, with a usable continuation.

use chrono::DateTime;
use mkc_store_interface::build_log::{BuildLogChunk, BuildLogWindow};
use mkc_store_interface::build_state::BuildStream;

use super::super::projection::log;

#[test]
fn replacement_decoding_keeps_each_log_window_within_256_kib() {
    let chunks = (1..=4)
        .map(|sequence| BuildLogChunk {
            sequence,
            attempt: 1,
            step: None,
            stream: BuildStream::Stdout,
            bytes: vec![0xff; 65_536],
            created_at: DateTime::UNIX_EPOCH,
        })
        .collect();
    let view = log(BuildLogWindow {
        chunks,
        next_after: 4,
        complete: true,
        head_sequence: 4,
        elided_bytes: 0,
    });
    assert_eq!(view.chunks.len(), 1);
    assert_eq!(view.next_after, 1);
    assert!(!view.complete);
    assert!(
        view.chunks
            .iter()
            .map(|chunk| chunk.text.len())
            .sum::<usize>()
            <= 262_144
    );
}
