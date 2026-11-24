//! A kept view is read again when an input of its link checks or its residency changed.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_types::{Comparison, ComparisonResult};
use mokly_graph::types::RenderGeneration;

use super::head_fixture::{Fixture, TARGET, attempt, engine, read, request};
use super::publication::publish;

fn entries(names: &[&str]) -> BTreeSet<String> {
    names.iter().map(|name| String::from(*name)).collect()
}

/// Accept one classification of the current files, then return the store and the base.
fn accepted(head: &Fixture, base: &Fixture) -> (MemoryComparisons, Arc<dyn RenderGeneration>) {
    let previous = engine().capture_base(base.state().head).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let first = attempt(&store);
    first
        .compare_prepared(&request(), previous.clone(), head.state().head)
        .unwrap();
    first.accept();
    (store, previous)
}

fn same_as_full(
    result: ComparisonResult,
    previous: Arc<dyn RenderGeneration>,
    head: Arc<dyn RenderGeneration>,
) {
    let full = engine()
        .compare_prepared(&request(), previous, head)
        .unwrap();
    assert_eq!(publish(result), publish(full));
}

#[test]
fn referrer_of_a_changed_link_target_reads_its_document_again() {
    let base = Fixture::new();
    let head = Fixture::new();
    let (store, previous) = accepted(&head, &base);
    head.tree.write(
        "specs/target.screen.html",
        &TARGET.replace(">Target</h1>", ">Target edited</h1>"),
    );
    let state = head.state();
    head.cache.take_inserts();
    let next = attempt(&store);
    let result = next
        .compare_prepared(&request(), previous.clone(), state.head.clone())
        .unwrap();
    assert_eq!(read(&state, &head), entries(&["home", "target"]));
    assert_eq!(
        next.work().validation_walks,
        2,
        "the referrer's closure facts stay proven"
    );
    same_as_full(result, previous, state.head);
}

#[test]
fn referrer_of_added_or_removed_link_target_views_is_validated_again() {
    let base = Fixture::new();
    let head = Fixture::new();
    let light = TARGET.replace("title: Target", "title: Target\ncolorSchemes: [light]");
    for fixture in [&base, &head] {
        fixture.tree.write(
            "mokly.config.json",
            "{\"colorSchemes\": [\"light\", \"dark\"]}",
        );
        fixture.tree.write("specs/target.screen.html", &light);
    }
    let (store, previous) = accepted(&head, &base);
    let both = TARGET.replace(
        "title: Target",
        "title: Target\ncolorSchemes: [light, dark]",
    );
    for (scenario, target) in [("added", both), ("removed", light)] {
        head.tree.write("specs/target.screen.html", &target);
        let state = head.state();
        head.cache.take_inserts();
        let next = attempt(&store);
        let result = next
            .compare_prepared(&request(), previous.clone(), state.head.clone())
            .unwrap();
        assert_eq!(
            read(&state, &head),
            entries(&["badge", "home", "other", "target"]),
            "{scenario} target views"
        );
        assert_eq!(next.work().validation_reused, 0, "{scenario} target views");
        same_as_full(result, previous.clone(), state.head);
        next.accept();
    }
}

#[test]
fn proven_view_without_a_cached_document_takes_the_checked_read() {
    let base = Fixture::new();
    let head = Fixture::new();
    let (store, previous) = accepted(&head, &base);
    let state = head.state();
    for route in ["home/index.desktop.html", "home/index.mobile.html"] {
        head.cache.drop_key(&state.key(route));
    }
    head.cache.take_inserts();
    let next = attempt(&store);
    let result = next
        .compare_prepared(&request(), previous.clone(), state.head.clone())
        .unwrap();
    assert_eq!(read(&state, &head), entries(&["home"]));
    for route in ["home/index.desktop.html", "home/index.mobile.html"] {
        assert!(
            head.cache.holds(&state.key(route)),
            "{route} is cached again"
        );
    }
    same_as_full(result, previous, state.head);
}
