//! The built CLI preserves physical and supplier CSS ownership through Git comparison.

mod changes_support;
#[path = "../../../tests/rust/containment_assertions.rs"]
mod containment_assertions;
#[path = "../../../tests/rust/containment_fixture.rs"]
mod containment_fixture;
mod containment_support;

fn check(index: usize) {
    let case = containment_fixture::CASES[index];
    let review = containment_support::build(
        containment_fixture::sources(case, false),
        containment_fixture::sources(case, true),
    );
    containment_assertions::check(&review, case);
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
