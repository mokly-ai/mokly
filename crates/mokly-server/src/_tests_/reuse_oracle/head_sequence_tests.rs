//! Proven head views skip their checked reads and still publish a full validation's bytes.

use std::collections::BTreeSet;

use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_types::Comparison;

use super::head_fixture::{BADGE, Fixture, OTHER, State, attempt, engine, failure, read, request};
use super::publication::publish;

/// Apply one scenario of the sequence to the head repository.
fn edit(fixture: &Fixture, scenario: &str) {
    let tree = &fixture.tree;
    match scenario {
        "screen" => tree.write(
            "specs/other.screen.html",
            &OTHER.replace("<p>Other</p>", "<p>Other edited</p>"),
        ),
        "component" => tree.write(
            "specs/badge.component.html",
            &BADGE.replace("class=\"badge\"", "class=\"badge pill\""),
        ),
        "added-entry" => tree.write(
            "specs/extra.screen.html",
            "---\ntitle: Extra\n---\n<p>Extra</p>",
        ),
        "removed-entry" => tree.remove("specs/extra.screen.html"),
        "revert" => tree.write("specs/other.screen.html", OTHER),
        "failed-render" => tree.write(
            "specs/other.screen.html",
            &OTHER.replace("title: Other", "title: Broken"),
        ),
        "recovery" => tree.write("specs/other.screen.html", OTHER),
        _ => {}
    }
}

#[test]
fn edits_publish_the_bytes_and_diagnostics_of_a_full_validation() {
    let base = Fixture::new();
    let head = Fixture::new();
    let previous = engine().capture_base(base.state().head).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let mut last: Option<State> = None;
    let all = vec!["badge", "home", "other", "target"];
    for (scenario, expected, walks) in [
        ("initial", all.clone(), 0),
        ("screen", vec!["other"], 0),
        ("component", vec!["badge", "home", "target"], 0),
        (
            "added-entry",
            vec!["badge", "extra", "home", "other", "target"],
            8,
        ),
        ("removed-entry", all.clone(), 8),
        ("revert", vec!["other"], 0),
        ("failed-render", vec![], 0),
        ("recovery", vec![], 0),
    ] {
        edit(&head, scenario);
        let state = head.state();
        state.pass(last.as_ref());
        head.cache.take_inserts();
        let reuse = attempt(&store);
        let result = reuse.compare_prepared(&request(), previous.clone(), state.head.clone());
        let read = read(&state, &head);
        let full = engine().compare_prepared(&request(), previous.clone(), state.head.clone());
        match (result, full) {
            (Ok(result), Ok(full)) => {
                assert_eq!(
                    publish(result),
                    publish(full),
                    "published bytes after {scenario}"
                );
                reuse.accept();
            }
            (Err(result), Err(full)) => {
                assert_eq!(
                    failure(&result),
                    failure(&full),
                    "diagnostics after {scenario}"
                );
                reuse.discard();
            }
            (result, full) => panic!(
                "{scenario}: reuse {:?} and full {:?} disagree",
                result.err(),
                full.err()
            ),
        }
        assert_eq!(
            read,
            expected
                .into_iter()
                .map(String::from)
                .collect::<BTreeSet<_>>(),
            "entries read again after {scenario}"
        );
        assert_eq!(
            reuse.work().validation_walks,
            walks,
            "closure walks after {scenario}"
        );
        last = Some(state);
    }
}
