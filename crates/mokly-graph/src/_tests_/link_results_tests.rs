//! Pair admission charges retained storage before copying a requested fragment.

use crate::link_results::{LinkResults, MemoryLinkResults};

#[test]
fn records_presence_by_view_and_fragment_without_caching_a_callers_error() {
    let results = MemoryLinkResults::new(4096);
    results.record(3, "summary", true);
    results.record(3, "absent", false);
    assert_eq!(results.get(3, "summary"), Some(true));
    assert_eq!(results.get(3, "absent"), Some(false));
    assert_eq!(results.get(4, "summary"), None);
    assert_eq!(results.get(3, "other"), None);
    assert_eq!(results.len(), 2);
    let charge = (results.retained_bytes(), results.len());
    results.record(3, "summary", true);
    assert_eq!((results.retained_bytes(), results.len()), charge);
}

#[test]
fn overflow_keeps_prior_facts_and_rejects_an_oversized_fragment() {
    let results = MemoryLinkResults::new(256);
    results.record(0, "summary", true);
    assert_eq!(results.get(0, "summary"), Some(true));
    let charge = (results.retained_bytes(), results.len());
    assert!(charge.0 > 0);
    assert!(charge.0 <= 256);
    results.record(1, &"x".repeat(257), false);
    assert_eq!((results.retained_bytes(), results.len()), charge);
    for view in 1..100 {
        results.record(view, "summary", true);
    }
    assert_eq!(results.get(0, "summary"), Some(true));
    assert_eq!(results.get(99, "summary"), None);
    assert!(results.retained_bytes() <= 256);
}

#[test]
fn zero_capacity_keeps_no_pair_fact() {
    let results = MemoryLinkResults::new(0);
    results.record(0, "summary", true);
    assert_eq!(results.get(0, "summary"), None);
    assert_eq!(results.retained_bytes(), 0);
    assert_eq!(results.len(), 0);
}
