//! The background walks of one state replace that state's classification walks, once.

use std::sync::Arc;

use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_types::Comparison;
use mokly_graph::types::RenderGeneration;

use super::head_fixture::{Fixture, OTHER, State, TARGET, attempt, engine, request};
use super::publication::publish;

const OTHER_VIEWS: [&str; 2] = ["other/index.desktop.html", "other/index.mobile.html"];
const TARGET_VIEWS: [&str; 2] = ["target/index.desktop.html", "target/index.mobile.html"];
const NOTES: &str = "---\ntitle: Notes\n---\n# Notes\n\nThe notes of the team.\n";

/// Accept a classification of the initial files and return its state and the stores.
fn accepted(
    head: &Fixture,
    base: &Fixture,
) -> (State, MemoryComparisons, Arc<dyn RenderGeneration>) {
    let previous = engine().capture_base(base.state().head).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let state = head.state();
    let first = attempt(&store);
    first
        .compare_prepared(&request(), previous.clone(), state.head.clone())
        .unwrap();
    first.accept();
    (state, store, previous)
}

fn edit_other(head: &Fixture) {
    head.tree.write(
        "specs/other.screen.html",
        &OTHER.replace("<p>Other</p>", "<p>Other edited</p>"),
    );
}

#[test]
fn classification_replays_the_background_walks_of_its_own_state_once() {
    let base = Fixture::new();
    let head = Fixture::new();
    let (initial, store, previous) = accepted(&head, &base);
    edit_other(&head);
    let state = head.state();
    assert_eq!(state.pass(Some(&initial)), OTHER_VIEWS);
    let first = attempt(&store);
    let result = first
        .compare_prepared(&request(), previous.clone(), state.head.clone())
        .unwrap();
    assert_eq!(
        first.work().validation_walks,
        0,
        "the background walks replace the classification walks"
    );
    let full = engine()
        .compare_prepared(&request(), previous.clone(), state.head.clone())
        .unwrap();
    assert_eq!(publish(result), publish(full));
    first.discard();
    let again = attempt(&store);
    again
        .compare_prepared(&request(), previous, state.head.clone())
        .unwrap();
    assert_eq!(
        again.work().validation_walks,
        2,
        "the first classification released the background walks"
    );
}

#[test]
fn background_walks_of_one_state_never_reach_another_state() {
    let base = Fixture::new();
    let head = Fixture::new();
    let (initial, store, previous) = accepted(&head, &base);
    edit_other(&head);
    let replaced = head.state();
    assert_eq!(replaced.pass(Some(&initial)), OTHER_VIEWS);
    let current = head.state();
    let next = attempt(&store);
    next.compare_prepared(&request(), previous, current.head.clone())
        .unwrap();
    assert_eq!(
        next.work().validation_walks,
        2,
        "another state's background walks are not proofs here"
    );
    assert_eq!(replaced.inner.plans().len(), 8);
}

#[test]
fn foreground_renders_keep_no_walk_records() {
    let base = Fixture::new();
    let head = Fixture::new();
    let (_, store, previous) = accepted(&head, &base);
    edit_other(&head);
    head.tree.write(
        "specs/target.screen.html",
        &TARGET.replace(">Target</h1>", ">Target edited</h1>"),
    );
    let state = head.state();
    let routes: Vec<String> = OTHER_VIEWS.iter().map(|route| (*route).into()).collect();
    assert_eq!(state.background(&routes), OTHER_VIEWS);
    for route in TARGET_VIEWS {
        state.inner.render(route).unwrap();
    }
    let next = attempt(&store);
    next.compare_prepared(&request(), previous, state.head.clone())
        .unwrap();
    assert_eq!(
        next.work().validation_walks,
        2,
        "only the views that the pass read keep their walks"
    );
}

#[test]
fn background_reads_of_markdown_documents_keep_no_walk_records() {
    let base = Fixture::new();
    let head = Fixture::new();
    base.tree.write("specs/notes.md", NOTES);
    head.tree.write("specs/notes.md", NOTES);
    let (initial, store, previous) = accepted(&head, &base);
    head.tree.write(
        "specs/notes.md",
        &NOTES.replace("notes of the team", "edited notes"),
    );
    let state = head.state();
    let documents: Vec<String> = state
        .inner
        .plans()
        .iter()
        .filter(|(_, plan)| plan.viewport.is_none())
        .map(|(route, _)| route.clone())
        .collect();
    assert_eq!(documents.len(), 1, "the document has one route");
    assert_eq!(state.pass(Some(&initial)), documents);
    let next = attempt(&store);
    next.compare_prepared(&request(), previous, state.head.clone())
        .unwrap();
    assert_eq!(
        next.work().validation_walks,
        1,
        "the pass kept no walk record of the edited document, so its classification walks it"
    );
}
