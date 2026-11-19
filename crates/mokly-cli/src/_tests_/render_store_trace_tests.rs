//! Persistent state has independent counters and a sequenced idle observation.

use mokly_compare::render_pending::{StoreObserver, TraceStoreObserver};
use mokly_graph::document_store::StoreStats;

use super::serve_trace_tests::capture;

#[test]
fn render_store_timings_report_costs_and_an_ordered_idle_state_separately_from_memory_counts() {
    let records = capture(|| {
        for stage in ["identity", "initialize", "read", "write"] {
            let span = match stage {
                "identity" => tracing::info_span!("render.store.identity"),
                "initialize" => tracing::info_span!("render.store.initialize"),
                "read" => tracing::info_span!("render.store.read"),
                _ => tracing::info_span!("render.store.write"),
            };
            span.in_scope(|| {});
        }
        TraceStoreObserver.state(StoreStats {
            sequence: 7,
            queued: 2,
            active: 1,
            hits: 4,
            misses: 3,
            faults: 1,
            writes: 5,
            bytes: 128,
            drops: 2,
        });
        TraceStoreObserver.state(StoreStats {
            sequence: 9,
            queued: 0,
            active: 0,
            hits: 4,
            misses: 3,
            faults: 1,
            writes: 8,
            bytes: 256,
            drops: 2,
        });
    });
    let costs: Vec<_> = records
        .iter()
        .filter(|record| record["event"] == "end")
        .collect();
    assert_eq!(costs.len(), 4);
    assert_eq!(costs[2]["stage"], "render.store.read");
    assert_eq!(costs[3]["stage"], "render.store.write");
    assert_eq!(costs[2]["durationMs"], 0);
    let states: Vec<_> = records
        .iter()
        .filter(|record| record["stage"] == "render.store")
        .collect();
    assert_eq!(states.len(), 2);
    assert_eq!(states[0]["sequence"], 7);
    assert_eq!(states[1]["sequence"], 9);
    assert_eq!(states[1]["event"], "state");
    assert_eq!(states[1]["queued"], 0);
    assert_eq!(states[1]["active"], 0);
    assert_eq!(states[1]["hits"], 4);
    assert_eq!(states[1]["misses"], 3);
    assert_eq!(states[1]["faults"], 1);
    assert_eq!(states[1]["writes"], 8);
    assert_eq!(states[1]["bytes"], 256);
    assert_eq!(states[1]["drops"], 2);
    assert!(
        !records
            .iter()
            .any(|record| record["stage"] == "render.cache")
    );
}
