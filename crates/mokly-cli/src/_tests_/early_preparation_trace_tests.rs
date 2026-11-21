//! Opt-in early counters preserve the timing schema and exclude authored inputs.

use super::serve_trace_tests::capture;

#[test]
fn early_preparation_deltas_are_numeric_counts_without_authored_data() {
    let records = capture(
        || tracing::info!(target: "mokly::early_preparation", started = 1_u64, aborted = 2_u64, adopted = 3_u64, published_waits = 4_u64, published_wait_ms = 5_u64, generation = "private-generation", context = "private-context", path = "private-path", source = "private-text"),
    );
    assert_eq!(records.len(), 1);
    let record = &records[0];
    assert_eq!(record["schemaVersion"], 1);
    assert_eq!(record["role"], "core");
    assert_eq!(record["stage"], "sidecar.early-preparation");
    assert_eq!(record["event"], "counts");
    for (key, value) in [
        ("started", 1),
        ("aborted", 2),
        ("adopted", 3),
        ("publishedWaits", 4),
        ("publishedWaitMs", 5),
    ] {
        assert_eq!(record[key], value);
    }
    assert!(!record.to_string().contains("private"));
}
