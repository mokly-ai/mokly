//! Reused closures still supply complete current validation and comparison inputs.

use mokly_compare::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};
use mokly_compare::comparison_types::Comparison;

use super::support::{Fixture, HOME, attempt, engine, output, request};

#[test]
fn unchanged_head_reuses_closures_and_checks_each_document_only_once() {
    let base = Fixture::new();
    let head = Fixture::new();
    let previous = engine().capture_base(base.generation()).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let initial = attempt(&store);
    initial
        .compare_prepared(&request(), previous.clone(), head.generation())
        .unwrap();
    initial.accept();
    let current = head.generation();
    let reused = attempt(&store);
    let reads = head.cache.stats();
    let result = reused
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    let checked = head.cache.stats();
    assert_eq!(
        checked.hits + checked.misses - reads.hits - reads.misses,
        4,
        "the complete classification must read each head document once, including the stream"
    );
    let full = engine()
        .compare_prepared(&request(), previous, current)
        .unwrap();
    assert_eq!(output(&result), output(&full));
    assert_eq!(
        reused.work().validation_reused,
        4,
        "every unchanged head closure must be proved"
    );
    assert_eq!(
        reused.work().validation_walks,
        0,
        "a proved closure must not walk again"
    );
    assert_eq!(
        reused.work().validation_documents,
        4,
        "head validation checks each current document once"
    );
    assert_eq!(
        reused.work().compared,
        0,
        "all view comparisons remain reusable"
    );
}

#[test]
fn changed_document_key_runs_ordinary_validation_without_an_extra_proof_read() {
    let base = Fixture::new();
    let head = Fixture::new();
    let previous = engine().capture_base(base.generation()).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let first = attempt(&store);
    first
        .compare_prepared(&request(), previous.clone(), head.generation())
        .unwrap();
    first.accept();
    head.write(
        "specs/home.screen.html",
        &HOME.replace("<h1>Home</h1>", "<h1>Edited</h1>"),
    );
    let current = head.generation();
    let reads = head.cache.stats();
    let next = attempt(&store);
    let result = next
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    let checked = head.cache.stats();
    assert_eq!(
        checked.hits + checked.misses - reads.hits - reads.misses,
        8,
        "four validation reads, two changed checked comparison reads, and two ordinary closure reads, with no extra proof read"
    );
    assert_eq!(next.work().validation_reused, 2);
    assert_eq!(next.work().validation_walks, 2);
    assert_eq!(next.work().reused, 2);
    assert_eq!(next.work().compared, 2);
    let full = engine()
        .compare_prepared(&request(), previous, current)
        .unwrap();
    assert_eq!(output(&result), output(&full));
}

#[test]
fn base_reference_refresh_and_all_other_fences_validate_the_same_current_head() {
    let base = Fixture::new();
    let head = Fixture::new();
    let previous = engine().capture_base(base.generation()).unwrap();
    let current = head.generation();
    for changed in ["base-reference", "base-commit", "catalogue", "settings"] {
        let store = MemoryComparisons::new(32 * 1024 * 1024);
        let first = attempt(&store);
        first
            .compare_prepared(&request(), previous.clone(), current.clone())
            .unwrap();
        first.accept();
        let mut input = request();
        let mut settings = "settings";
        match changed {
            "base-reference" => input.base_ref = "another-base".into(),
            "base-commit" => input.base_commit = "d".repeat(40),
            "catalogue" => input.catalogue_identity = "e".repeat(64),
            "settings" => settings = "changed-settings",
            _ => unreachable!(),
        }
        let next = store.begin(engine(), ReuseFence::new(&settings));
        let result = next
            .compare_prepared(&input, previous.clone(), current.clone())
            .unwrap();
        let full = engine()
            .compare_prepared(&input, previous.clone(), current.clone())
            .unwrap();
        assert_eq!(output(&result), output(&full), "changed {changed}");
        assert_eq!(next.work().compared, 4, "changed {changed}");
        assert_eq!(next.work().validation_reused, 0, "changed {changed}");
    }
}
