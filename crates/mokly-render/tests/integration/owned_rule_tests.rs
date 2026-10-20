//! Owned registry rules retain evidence without making nested-only parents direct changes.

use std::fs;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::ReviewState;

use super::base_styles_tests::{compare, consumer};

#[test]
fn registry_rules_inside_a_nested_component_do_not_change_the_parent_page() {
    let base = consumer("'red'");
    let head = consumer("'blue'");
    for (consumer, color) in [(&base, "red"), (&head, "blue")] {
        fs::write(
            consumer.root().join("owned/card.mockup.tsx"),
            format!(
                "import {{defineComponent}} from '@mokly/mokly';
                import styled from 'styled-components';
                const Label=styled.p`color:{color}`;
                export const card=defineComponent({{title:'Card',description:'',relatedDocs:[],propSchema:{{type:'object',properties:{{}},additionalProperties:false}},props:{{}},element:'ui-card',render:()=> <Label>Card</Label>}});"
            ),
        ).unwrap();
        fs::write(
            consumer.root().join("owned/parent.mockup.tsx"),
            "import {defineComponent} from '@mokly/mokly';
            import {card} from './card.mockup';
            export const parent=defineComponent({title:'Parent',description:'',relatedDocs:[],propSchema:{type:'object',properties:{},additionalProperties:false},props:{},element:'ui-parent',render:()=> <main><card.Component /></main>});",
        ).unwrap();
        fs::write(
            consumer.root().join("owned/home.screen.html"),
            "---\ntitle: Home\n---\n<ui-parent></ui-parent>",
        )
        .unwrap();
    }
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    let parent = result
        .entries
        .iter()
        .find(|entry| entry.path == "parent")
        .unwrap();
    assert!(parent.reasons.is_empty());
    assert!(
        parent
            .documents
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
    assert!(
        result
            .review
            .affected
            .iter()
            .any(|entry| entry.consumer.path == "parent")
    );
}

#[test]
fn unused_owned_rules_change_no_view_or_component() {
    let base = consumer("'red'");
    let head = consumer("'blue'");
    for consumer in [&base, &head] {
        consumer.replace("owned/card.mockup.tsx", ".card-${props.label}", ".unused");
    }
    let result = compare(&base, &head);
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.review.affected.is_empty());
    for view in result.entries.iter().flat_map(|entry| &entry.documents) {
        assert_eq!(view.state, ReviewState::Unchanged);
        assert!(
            view.evidence
                .rules
                .iter()
                .all(|rule| rule.status == RuleStatus::Excluded)
        );
    }
}

#[test]
fn unresolved_owned_rules_keep_the_conservative_entry_record() {
    let base = consumer("'red'");
    let head = consumer("'blue'");
    for consumer in [&base, &head] {
        consumer.replace("owned/card.mockup.tsx", ".card-${props.label}", "body");
    }
    let result = compare(&base, &head);
    assert_eq!(
        result.snapshot.changed_entries,
        ["card", "card/other", "home"]
    );
    assert!(result.review.affected.is_empty());
    for view in result.entries.iter().flat_map(|entry| &entry.documents) {
        assert_eq!(view.evidence.rules.len(), 1);
        assert_eq!(view.evidence.rules[0].selector, "body");
        assert_eq!(view.evidence.rules[0].status, RuleStatus::Unresolved);
        assert_eq!(view.evidence.rules[0].owner, EvidenceOwner::Entry);
    }
}

#[test]
fn matched_owned_rules_share_the_document_with_unused_ownerless_rules() {
    let base = consumer("'red'");
    let head = consumer("'blue'");
    for (consumer, color) in [(&base, "red"), (&head, "blue")] {
        fs::write(
            consumer.root().join("owned/reference.page.html"),
            format!("---\ntitle: Reference\n---\n<!doctype html><html><head><style>.unused{{color:{color}}}</style></head><body><ui-card label=\"Instance\"></ui-card></body></html>"),
        ).unwrap();
    }
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["card", "card/other"]);
    let page = result
        .entries
        .iter()
        .find(|entry| entry.path == "reference")
        .unwrap();
    assert!(!page.included);
    for view in &page.documents {
        assert_eq!(view.evidence.rules.len(), 1);
        assert_eq!(view.evidence.rules[0].status, RuleStatus::Matched);
        assert_eq!(
            view.evidence.rules[0].owner,
            EvidenceOwner::Component {
                path: "card".into()
            }
        );
    }
}
