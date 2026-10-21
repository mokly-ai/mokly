//! Exact Changes, Affected, and per-rule evidence for the shared catalogue.

use std::collections::BTreeSet;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{ReviewResultV8, ReviewState};

use super::containment_fixture::{Case, Edit};

pub fn check(review: &ReviewResultV8, case: Case) {
    let fallback = case.head_style && !case.preview;
    let expected = match case.edit {
        Edit::Button => vec!["button"],
        Edit::Card => vec!["card"],
        Edit::Page => vec!["page"],
        Edit::Stack if fallback => vec!["page"],
        Edit::Stack => vec!["stack"],
        Edit::Both => vec!["button", "stack"],
    };
    let changed: Vec<_> = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect();
    assert_eq!(changed, expected, "{case:?}");
    let affected: BTreeSet<_> = review
        .affected
        .iter()
        .map(|row| {
            (
                row.changed_component_id.as_str(),
                row.consumer.path.as_str(),
            )
        })
        .collect();
    let expected_affected = match case.edit {
        Edit::Button => vec![("button", "card"), ("button", "page")],
        Edit::Card => vec![("card", "page")],
        Edit::Page => vec![],
        Edit::Stack if fallback => vec![],
        Edit::Stack => vec![("stack", "page")],
        Edit::Both => vec![("button", "card"), ("button", "page"), ("stack", "page")],
    };
    assert_eq!(
        affected,
        expected_affected.into_iter().collect::<BTreeSet<_>>(),
        "{case:?}"
    );
    let page = review
        .entries
        .iter()
        .find(|entry| entry.path == "page")
        .unwrap();
    let expected_rules = match case.edit {
        Edit::Button => vec![(".button", "button")],
        Edit::Card => vec![(".card.button", "card")],
        Edit::Page => vec![(".card", "entry")],
        Edit::Stack => vec![(".stack>*+*", if fallback { "entry" } else { "stack" })],
        Edit::Both => vec![(".button", "button"), (".stack>*+*", "stack")],
    };
    for view in &page.views {
        assert_eq!(
            view.state,
            if expected.contains(&"page") {
                ReviewState::Changed
            } else {
                ReviewState::Unchanged
            },
            "{case:?}"
        );
        let actual: BTreeSet<_> = view
            .rules
            .iter()
            .filter(|rule| rule.status == RuleStatus::Matched)
            .map(|rule| {
                (
                    rule.selector
                        .chars()
                        .filter(|character| !character.is_whitespace())
                        .collect::<String>(),
                    match &rule.owner {
                        EvidenceOwner::Entry => "entry",
                        EvidenceOwner::Component { path } => path,
                    },
                )
            })
            .collect();
        assert_eq!(
            actual,
            expected_rules
                .iter()
                .map(|(selector, owner)| (selector.to_string(), *owner))
                .collect::<BTreeSet<_>>(),
            "{case:?}"
        );
    }
}
