//! Private reuse work and proof durations survive the opt-in timing filter.

use super::serve_trace_tests::capture;

#[test]
fn comparison_reuse_reports_actual_work_charge_and_revalidation_duration() {
    let records = capture(|| {
        let span = tracing::info_span!(
            "review.compare-views",
            status = "error",
            views = 5u64,
            reused = 4u64,
            compared = 1u64,
            recorded_reads = 28u64,
            retained_bytes = 4096u64,
            revalidation_ms = tracing::field::Empty,
            recording_ms = tracing::field::Empty,
            recording_identity_reads = 8u64,
            current_usage_ms = tracing::field::Empty,
            identities_checked = 24u64,
            identity_reads = 12u64,
            peak_bytes = 8192u64,
            candidate_views = 3u64,
            candidate_bytes = 2048u64,
            accepted_bytes = 1024u64,
            overflowed = true
        );
        let _scope = span.enter();
        span.record("revalidation_ms", 1.25f64);
        span.record("recording_ms", 2.5f64);
        span.record("current_usage_ms", 3.75f64);
        span.record("status", "ok");
    });
    let result = records
        .iter()
        .find(|record| record["stage"] == "review.compare-views" && record["event"] == "end")
        .unwrap();
    assert_eq!(result["reused"], 4);
    assert_eq!(result["compared"], 1);
    assert_eq!(result["recordedReads"], 28);
    assert_eq!(result["retainedBytes"], 4096);
    assert_eq!(result["revalidationMs"], 1.25);
    assert_eq!(result["recordingMs"], 2.5);
    assert_eq!(result["recordingIdentityReads"], 8);
    assert_eq!(result["currentUsageMs"], 3.75);
    assert_eq!(result["identitiesChecked"], 24);
    assert_eq!(result["identityReads"], 12);
    assert_eq!(result["peakBytes"], 8192);
    assert_eq!(result["candidateViews"], 3);
    assert_eq!(result["candidateBytes"], 2048);
    assert_eq!(result["acceptedBytes"], 1024);
    assert_eq!(result["overflowed"], true);
}
