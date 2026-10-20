//! Byte reservations reject excess Rust metadata and preserve fallback review bytes.

use std::mem;
use std::sync::Arc;

use mokly_graph::types::RenderSummary;

use mokly_model::canonical;

use crate::capture_weight::{self, Budget, DEFAULT_BASE_CAPTURE_BYTES};
use crate::comparison_capture::{CapturedGeneration, capture_with_bound};

use super::support::{self, Probe};

#[test]
fn exact_byte_bound_is_never_exceeded() {
    assert_eq!(DEFAULT_BASE_CAPTURE_BYTES, 256 * 1024 * 1024);
    let mut budget = Budget::new(256);
    assert!(budget.retain(200));
    assert!(!budget.retain(57));
    assert_eq!(budget.retained, 200);
    assert!(budget.retain(56));
    assert!(!budget.retain(1));
    assert_eq!(budget.retained, 256);
}

#[test]
fn zero_and_partial_captures_fall_back_with_identical_review_bytes() {
    let fixed = mem::size_of::<CapturedGeneration>()
        + capture_weight::summary(&RenderSummary {
            documents: 4,
            closure: (0..128)
                .map(|index| format!("public/{index}.svg"))
                .collect(),
            ..Default::default()
        });
    let run = |bound| {
        let probe = Arc::new(Probe {
            capture_base: bound >= fixed,
            forbid_base_after_head: bound == DEFAULT_BASE_CAPTURE_BYTES,
            ..Default::default()
        });
        let source = support::generation("base", 4, probe.clone(), 128);
        let before = capture_with_bound(source.clone(), bound).unwrap();
        if bound < fixed {
            assert!(Arc::ptr_eq(&source, &before));
        }
        if bound >= fixed {
            let retained = before.comparison_capture().unwrap();
            assert!(retained.retained_bytes <= bound);
            assert!(retained.encoded_bytes <= retained.retained_bytes);
            if bound == 96 * 1024 {
                assert_eq!(retained.views, 1);
            }
        }
        let after = support::generation("head", 4, probe.clone(), 128);
        let result = support::engine()
            .compare_captured(&support::request(), before, after)
            .unwrap();
        assert_eq!(result.counts.changes, 4);
        assert!(
            String::from_utf8_lossy(&result.after.render("page-0/index.html").unwrap().bytes)
                .contains("head")
        );
        let fallback = probe
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|(side, _, head)| *side == "base" && *head)
            .count();
        (
            canonical::to_string(&result.review).unwrap(),
            canonical::to_string(&result.snapshot).unwrap(),
            fallback,
        )
    };
    let fitting = run(DEFAULT_BASE_CAPTURE_BYTES);
    assert_eq!(fitting.2, 0);
    for bound in [0, 1, 32 * 1024, 96 * 1024] {
        let fallback = run(bound);
        assert!(
            fallback.2 > 0,
            "bound {bound} must reject retained closure metadata"
        );
        assert_eq!(fallback.0, fitting.0);
        assert_eq!(fallback.1, fitting.1);
    }
}
