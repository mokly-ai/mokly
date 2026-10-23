//! The Layout/Title case uses real CSS-in-JS on a supplier's slot element.

use std::fs;

use mokly_model::review::ReviewState;

use super::base_styles_tests::{compare, consumer};

#[path = "../../../../tests/rust/supplier_fixture.rs"]
mod supplier_fixture;

#[test]
fn layout_title_keeps_the_suppliers_own_changed_view() {
    let base = consumer("'black'");
    let head = consumer("'black'");
    for (consumer, color) in [(&base, "red"), (&head, "blue")] {
        for (file, source) in supplier_fixture::sources("title", color) {
            fs::write(consumer.root().join("owned").join(file), source).unwrap();
        }
    }
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert_eq!(result.review.affected.len(), 1);
    assert_eq!(result.review.affected[0].consumer.path, "home");
    let card = result
        .entries
        .iter()
        .find(|entry| entry.path == "card")
        .unwrap();
    assert!(
        card.documents
            .iter()
            .all(|view| view.state == ReviewState::Changed)
    );
}

#[test]
fn repeated_supplier_path_keeps_declared_and_ownerless_claims_separate() {
    let base = consumer("'black'");
    let head = consumer("'black'");
    for (consumer, color) in [(&base, "red"), (&head, "blue")] {
        fs::remove_file(consumer.root().join("owned/card.mockup.tsx")).unwrap();
        for (file, source) in supplier_fixture::repeated(color) {
            fs::write(consumer.root().join("owned").join(file), source).unwrap();
        }
    }
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["child", "parent"]);
    let whole = result
        .entries
        .iter()
        .find(|entry| entry.path == "whole")
        .unwrap();
    assert!(
        whole
            .documents
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
}
