//! Render cache counts close each phase that reads or fills the shared cache.

use mokly_graph::cache::CacheStats;
use serde_json::{Map, Value, json};

/// Phases whose end record follows one count record of the shared render cache.
pub(super) fn phase(stage: &str) -> bool {
    matches!(
        stage,
        "serve.background"
            | "changes.classify"
            | "review.capture-side"
            | "review.compare-views"
            | "output.write"
    )
}

/// Cache operations between the phase start and end, and the retained totals at the end.
pub(super) fn counts(start: &CacheStats, end: &CacheStats) -> Map<String, Value> {
    Map::from_iter([
        ("hits".into(), json!(end.hits.saturating_sub(start.hits))),
        (
            "restores".into(),
            json!(end.restores.saturating_sub(start.restores)),
        ),
        (
            "restoreFailures".into(),
            json!(end.restore_failures.saturating_sub(start.restore_failures)),
        ),
        (
            "misses".into(),
            json!(end.misses.saturating_sub(start.misses)),
        ),
        (
            "evictions".into(),
            json!(end.evictions.saturating_sub(start.evictions)),
        ),
        ("chargedBytes".into(), json!(end.bytes)),
        ("entries".into(), json!(end.entries)),
    ])
}
