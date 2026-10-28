//! The running PostCSS cache charge equals a full recount after every change.

use mokly_sidecar::postcss_evidence::{Evidence, Read};
use mokly_sidecar::results::Css;

use crate::postcss_cache::{CssCache, CssRecord};
use crate::postcss_scan::Scan;

fn record(text: &str, reads: usize) -> CssRecord {
    CssRecord {
        result: Css {
            read_evidence: Evidence {
                reads: (0..reads)
                    .map(|index| Read::WholeFile {
                        identity: None,
                        path: format!("/repo/module-{index}.js"),
                        digest: "a".repeat(64),
                    })
                    .collect(),
                ..Default::default()
            },
            unmapped_dependency_directories: None,
            text: text.into(),
            dependencies: Vec::new(),
        },
        processed: None,
    }
}

fn recount(cache: &CssCache) -> usize {
    cache
        .records
        .iter()
        .map(|(key, record)| key.capacity() + record.retained_bytes())
        .sum::<usize>()
        + cache
            .scans
            .iter()
            .map(|(key, scan)| key.capacity() + scan.retained_bytes())
            .sum::<usize>()
}

#[test]
fn the_running_charge_matches_a_recount_after_inserts_replacements_purges_and_clears() {
    let mut cache = CssCache::default();
    cache.insert("one:a.css".into(), record("a{}", 10));
    cache.insert("one:b.css".into(), record("b{}", 20));
    cache.insert("two:a.css".into(), record("a{}", 30));
    assert_eq!(cache.retained_bytes(), recount(&cache));
    cache.insert("one:a.css".into(), record("a{color:red}", 40));
    assert_eq!(cache.records.len(), 3);
    assert_eq!(cache.retained_bytes(), recount(&cache));
    cache.scans.insert("one".into(), Scan::default());
    assert_eq!(cache.retained_bytes(), recount(&cache));
    cache.releases.send("one".into()).unwrap();
    cache.purge();
    assert_eq!(cache.records.keys().collect::<Vec<_>>(), ["two:a.css"]);
    assert!(cache.scans.is_empty());
    assert_eq!(cache.retained_bytes(), recount(&cache));
    let kept = cache.retained_bytes();
    let next = String::from("two:b.css").capacity() + record("b{}", 30).retained_bytes();
    cache.limit = kept + next - 1;
    cache.insert("two:b.css".into(), record("b{}", 30));
    assert_eq!(cache.records.keys().collect::<Vec<_>>(), ["two:b.css"]);
    assert_eq!(cache.retained_bytes(), recount(&cache));
    cache.limit = 1;
    cache.trim();
    assert!(cache.records.is_empty());
    assert_eq!(cache.retained_bytes(), 0);
}
