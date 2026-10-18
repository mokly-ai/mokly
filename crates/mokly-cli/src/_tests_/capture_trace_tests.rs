//! Capture timing output uses the injected clock and preserves error-then-ok status.

use std::sync::Arc;

use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest};
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use super::serve_trace_tests::capture;

#[test]
fn failed_capture_never_records_ok_or_success_counts() {
    let records = capture(|| {
        let engine = Engine {
            moves: Arc::new(Unimock::new(())),
            css: Arc::new(MemoryParsedCss::new(1024)),
        };
        let before = Arc::new(Unimock::new((
            RenderGenerationMock::comparison_capture
                .next_call(matching!())
                .returns(None),
            RenderGenerationMock::render_all
                .next_call(matching!())
                .returns(Err(GraphError::Runtime {
                    source: RuntimeDiagnostic {
                        code: RuntimeCode::Cancelled,
                        message: "private cancellation detail".into(),
                    },
                })),
        )));
        let request = ComparisonRequest {
            base_ref: "base".into(),
            base_commit: "a".repeat(40),
            catalogue_identity: "b".repeat(64),
        };
        assert!(
            engine
                .compare(&request, before, Arc::new(Unimock::new(())))
                .is_err()
        );
    });
    let captured: Vec<_> = records
        .iter()
        .filter(|record| record["stage"] == "review.capture-side")
        .collect();
    assert_eq!(captured.len(), 2);
    assert_eq!(captured[0]["event"], "start");
    assert_eq!(captured[1]["event"], "end");
    assert_eq!(captured[1]["status"], "error");
    for record in captured {
        assert!(record.get("views").is_none());
        assert!(record.get("retainedBytes").is_none());
        assert!(record.get("encodedBytes").is_none());
        assert!(!record.to_string().contains("private cancellation detail"));
    }
}

#[test]
fn successful_capture_emits_retention_counts_and_keeps_view_counts_off_end_records() {
    let records = capture(|| {
        let span = tracing::info_span!(
            "review.capture-side",
            status = "error",
            views = tracing::field::Empty,
            retained_bytes = tracing::field::Empty,
            encoded_bytes = tracing::field::Empty,
            path = "private path"
        );
        span.record("views", 3u64);
        span.record("retained_bytes", 128u64);
        span.record("encoded_bytes", 64u64);
        span.record("status", "ok");
    });
    assert_eq!(records.len(), 3);
    assert_eq!(records[0]["event"], "start");
    assert_eq!(records[1]["event"], "counts");
    assert_eq!(records[1]["views"], 3);
    assert_eq!(records[1]["retainedBytes"], 128);
    assert_eq!(records[1]["encodedBytes"], 64);
    assert_eq!(records[2]["status"], "ok");
    assert!(records[0].get("views").is_none());
    assert!(records[2].get("views").is_none());
    assert!(records.iter().all(|record| record.get("path").is_none()));
}
