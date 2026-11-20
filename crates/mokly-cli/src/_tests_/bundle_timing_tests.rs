//! Bundle timing fields reach structured output and the removed stage stays silent.

use serde_json::json;

use super::serve_trace_tests::capture;

#[test]
fn bundle_cache_outcomes_reach_terminal_records_and_describe_is_silent() {
    let records = capture(|| {
        for cache in [
            "hit",
            "memory",
            "no-record",
            "stamp-mismatch",
            "version-mismatch",
            "damaged",
            "unavailable",
        ] {
            let span = tracing::info_span!(
                "catalogue.bundle",
                status = "error",
                cache = tracing::field::Empty
            );
            let _scope = span.enter();
            span.record("cache", cache);
            span.record("status", "ok");
        }
        let _removed = tracing::info_span!("catalogue.describe", status = "ok").entered();
    });
    let ended: Vec<_> = records
        .iter()
        .filter(|record| record["event"] == "end")
        .collect();
    assert_eq!(records.len(), 14);
    assert_eq!(
        ended
            .iter()
            .map(|record| record["cache"].clone())
            .collect::<Vec<_>>(),
        [
            json!("hit"),
            json!("memory"),
            json!("no-record"),
            json!("stamp-mismatch"),
            json!("version-mismatch"),
            json!("damaged"),
            json!("unavailable")
        ]
    );
    for record in ended {
        assert_eq!(record["stage"], "catalogue.bundle");
        assert_eq!(record["status"], "ok");
    }
}
