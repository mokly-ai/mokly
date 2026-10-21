//! Both registry adapters attribute React parents and screens through the built CLI.

mod changes_support;
mod containment_support;
#[path = "../../../tests/rust/registry_assertions.rs"]
mod registry_assertions;
#[path = "../../../tests/rust/registry_fixture.rs"]
mod registry_fixture;

fn check(emotion: bool, edit: registry_fixture::Edit) {
    let review = containment_support::build(
        registry_fixture::sources(emotion, edit, false),
        registry_fixture::sources(emotion, edit, true),
    );
    registry_assertions::check(&review, edit);
}

#[test]
fn styled_component_and_screen_parents() {
    check(false, registry_fixture::Edit::Stack);
}
#[test]
fn emotion_component_and_screen_parents() {
    check(true, registry_fixture::Edit::Stack);
}
#[test]
fn styled_supplier_keeps_its_card_border() {
    check(false, registry_fixture::Edit::Supplier);
}
#[test]
fn emotion_supplier_keeps_its_card_border() {
    check(true, registry_fixture::Edit::Supplier);
}
#[test]
fn styled_button_and_stack_keep_separate_details() {
    check(false, registry_fixture::Edit::ButtonAndStack);
}
#[test]
fn emotion_button_and_stack_keep_separate_details() {
    check(true, registry_fixture::Edit::ButtonAndStack);
}
