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

#[test]
fn component_nested_stack_rule_matches_the_flat_rule() {
    let case = containment_fixture::CASES[3];
    let review = containment_support::build(
        containment_fixture::nested_sources(case, false),
        containment_fixture::nested_sources(case, true),
    );
    containment_assertions::check(&review, case);
}

#[test]
fn linked_stylesheet_nested_stack_rule_has_flat_evidence() {
    let source = |spacing| {
        vec![
            (
                "home.screen.html".into(),
                "---\ntitle: Home\n---\n<div class='stack'><i>A</i><i>B</i></div>".into(),
            ),
            (
                "styles.css".into(),
                format!(".stack {{ & > * + * {{ margin-top: {spacing}px }} }}"),
            ),
        ]
    };
    let config = r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["specs/styles.css"]}]}"#;
    let review = containment_support::build_configured(source(8), source(16), config);
    let home = review
        .entries
        .iter()
        .find(|entry| entry.path == "home")
        .unwrap();
    assert!(home.included);
    for view in &home.views {
        assert_eq!(view.state, mokly_model::review::ReviewState::Changed);
        assert_eq!(view.rules.len(), 1);
        assert_eq!(
            view.rules[0].status,
            mokly_model::evidence::RuleStatus::Matched
        );
        assert_eq!(
            view.rules[0].owner,
            mokly_model::evidence::EvidenceOwner::Entry
        );
    }
}

#[test]
fn head_nested_stack_rule_matches_the_flat_rule() {
    let case = containment_fixture::CASES[5];
    let review = containment_support::build(
        containment_fixture::nested_sources(case, false),
        containment_fixture::nested_sources(case, true),
    );
    let changed = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect::<Vec<_>>();
    assert_eq!(changed, ["stack"]);
    assert_eq!(
        review
            .affected
            .iter()
            .map(|row| (
                row.changed_component_id.as_str(),
                row.consumer.path.as_str()
            ))
            .collect::<Vec<_>>(),
        [("stack", "page")]
    );
    let page = review
        .entries
        .iter()
        .find(|entry| entry.path == "page")
        .unwrap();
    for view in &page.views {
        assert_eq!(view.rules.len(), 1);
        assert_eq!(
            view.rules[0].owner,
            mokly_model::evidence::EvidenceOwner::Component {
                path: "stack".into()
            }
        );
        assert_eq!(
            view.rules[0].status,
            mokly_model::evidence::RuleStatus::Matched
        );
    }
}
