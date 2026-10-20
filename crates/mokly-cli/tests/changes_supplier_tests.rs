//! The built CLI retains decision 73 supplier, child-element, and self-copy behavior.

use mokly_model::evidence::EvidenceOwner;
use mokly_model::review::ReviewState;

mod changes_support;
mod containment_support;
#[path = "../../../tests/rust/supplier_fixture.rs"]
mod supplier_fixture;

use supplier_fixture::{repeated, sources};

fn check(case: &str) {
    let review = containment_support::build(sources(case, "red"), sources(case, "blue"));
    assert_eq!(
        review
            .entries
            .iter()
            .filter(|entry| entry.included)
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>(),
        ["card"]
    );
    assert_eq!(review.affected.len(), 1);
    assert_eq!(review.affected[0].changed_component_id, "card");
    assert_eq!(review.affected[0].consumer.path, "home");
    let own = review
        .entries
        .iter()
        .find(|entry| entry.path == "card")
        .unwrap();
    assert!(
        own.views
            .iter()
            .all(|view| view.state == ReviewState::Changed)
    );
}

#[test]
fn layout_title_rule_keeps_the_supplier_changed() {
    check("title");
}
#[test]
fn supplied_slot_rule_keeps_the_supplier_changed() {
    check("slot");
}
#[test]
fn parent_rule_for_child_element_keeps_the_parent_changed() {
    check("element");
}
#[test]
fn self_nested_copy_keeps_its_own_view_match() {
    check("self");
}

#[test]
fn repeated_supplier_path_preserves_exact_owned_proof_and_physical_head_proof() {
    let review = containment_support::build(repeated("red"), repeated("blue"));
    assert_eq!(
        review
            .entries
            .iter()
            .filter(|entry| entry.included)
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>(),
        ["child", "parent"]
    );
    for path in ["home", "whole"] {
        let consumer = review
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .unwrap();
        assert!(
            consumer
                .views
                .iter()
                .all(|view| view.state == ReviewState::Unchanged)
        );
        for view in &consumer.views {
            let owners: Vec<_> = view.rules.iter().map(|rule| rule.owner.clone()).collect();
            let mut expected = vec![EvidenceOwner::Component {
                path: "child".into(),
            }];
            if path == "home" {
                expected.push(EvidenceOwner::Component {
                    path: "parent".into(),
                });
            }
            assert_eq!(owners, expected);
        }
    }
}
