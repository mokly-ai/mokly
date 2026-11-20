//! Output tails remove terminal controls and keep the final fifty lines.

use std::sync::Arc;

use mkc_store_interface::build_log::{BuildLogChunk, BuildLogWindow, BuildLogsMock};
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStream};
use unimock::{MockFn, Unimock, matching};

use crate::build_check_summary::BuildCheckOutput;
use crate::build_check_worker::BuildCheckDelivery;
use crate::tests::build_fixtures::{build, locations, now, transactions};

#[test]
fn terminal_output_normalizes_escapes_controls_and_carriage_returns_before_line_selection() {
    let mut build = build(BuildState::Failed);
    build.failure_cause = Some(BuildFailure::Exit);
    build.log_sequence = 2;
    let mut bytes = (0..55)
        .map(|index| format!("line {index}\r"))
        .collect::<String>()
        .into_bytes();
    bytes.extend_from_slice(
        b"\x1b[31mred\x1b[0m\r\n\x1b]8;;https://example.com\x07link\x1b]8;;\x1b\\\x00\x08\n",
    );
    let queries = Unimock::new(
        BuildLogsMock::build_log
            .some_call(matching!(_, _, 0, 100))
            .returns(Ok(Some(BuildLogWindow {
                chunks: vec![BuildLogChunk {
                    sequence: 1,
                    attempt: 1,
                    step: None,
                    stream: BuildStream::Stderr,
                    bytes,
                    created_at: now(),
                }],
                next_after: 2,
                complete: true,
                head_sequence: 0,
                elided_bytes: 0,
            }))),
    );
    let worker = BuildCheckDelivery {
        transactions: transactions(queries),
        github: Arc::new(Unimock::new(())),
        publications: Arc::new(Unimock::new(())),
        runtime: Arc::new(Unimock::new(())),
        locations: locations(),
    };
    let tail = worker.output_tail(&build).unwrap();
    assert_eq!(tail.lines().count(), 50);
    assert!(tail.starts_with("line 7\n"));
    assert!(tail.ends_with("red\nlink"));
    assert!(!tail.contains("https://example.com"));
}
