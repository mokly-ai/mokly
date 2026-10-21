//! Decision 96 applies one match ownership contract to rendered CSS sources.

use std::fs;

use super::base_styles_tests::{compare, consumer};
use super::support::Consumer;

#[path = "../../../../tests/rust/containment_assertions.rs"]
mod containment_assertions;
#[path = "../../../../tests/rust/containment_fixture.rs"]
mod containment_fixture;

fn fixture(case: containment_fixture::Case, changed: bool) -> Consumer {
    let consumer = consumer("'black'");
    fs::remove_file(consumer.root().join("owned/card.mockup.tsx")).unwrap();
    fs::remove_file(consumer.root().join("owned/home.screen.html")).unwrap();
    for (file, source) in containment_fixture::sources(case, changed) {
        fs::write(consumer.root().join("owned").join(file), source).unwrap();
    }
    consumer
}

fn check(index: usize) {
    let case = containment_fixture::CASES[index];
    let result = compare(&fixture(case, false), &fixture(case, true));
    containment_assertions::check(&result.review, case);
}

#[test]
fn button_color_keeps_card_and_page_affected() {
    check(0);
}
#[test]
fn card_button_margin_keeps_page_affected() {
    check(1);
}
#[test]
fn page_border_is_not_taken_by_the_slot_receiver() {
    check(2);
}
#[test]
fn owned_stack_spacing_keeps_page_affected() {
    check(3);
}
#[test]
fn owned_stack_spacing_needs_no_own_preview_children() {
    check(4);
}
#[test]
fn ownerless_stack_spacing_uses_own_page_proof() {
    check(5);
}
#[test]
fn ownerless_stack_spacing_without_own_matches_falls_back_to_page() {
    check(6);
}
#[test]
fn button_and_stack_rules_keep_independent_owners() {
    check(7);
}
