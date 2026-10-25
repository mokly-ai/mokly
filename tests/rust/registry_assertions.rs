//! Exact Changes, Affected, and Details evidence for each registry adapter.

use std::collections::BTreeSet;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{ReviewResultV8, ReviewState};

use super::registry_fixture::Edit;

pub fn check(review: &ReviewResultV8, edit: Edit) {
    let changed: Vec<_> = review
        .entries
        .iter()
        .filter(|row| row.included)
        .map(|row| row.path.as_str())
        .collect();
    let expected = match edit {
        Edit::Stack => vec!["stack"],
        Edit::Supplier => vec!["layout"],
        Edit::ButtonAndStack => vec!["button", "stack"],
    };
    assert_eq!(changed, expected, "{edit:?}");
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
    let mut want = BTreeSet::new();
    for owner in &expected {
        let consumers: &[&str] = match *owner {
            "layout" => &["home", "whole"],
            "stack" => &["home", "layout", "page", "whole"],
            _ => &["card", "home", "layout", "page", "whole"],
        };
        for consumer in consumers {
            want.insert((*owner, *consumer));
        }
    }
    assert_eq!(affected, want, "{edit:?}");
    for path in ["home", "whole"] {
        let row = review.entries.iter().find(|row| row.path == path).unwrap();
        for view in &row.views {
            assert_eq!(view.state, ReviewState::Unchanged, "{path}");
            let rules: BTreeSet<_> = view
                .rules
                .iter()
                .filter(|rule| rule.status == RuleStatus::Matched)
                .map(|rule| {
                    let EvidenceOwner::Component { path } = &rule.owner else {
                        panic!("entry owned rule {rule:?}");
                    };
                    (
                        rule.selector.split_whitespace().collect::<String>(),
                        path.as_str(),
                    )
                })
                .collect();
            let expected_rules = match edit {
                Edit::Stack => vec![(".stack>*+*", "stack")],
                Edit::Supplier => vec![(".layout.card", "layout")],
                Edit::ButtonAndStack => vec![(".button", "button"), (".stack>*+*", "stack")],
            };
            assert_eq!(
                rules,
                expected_rules
                    .into_iter()
                    .map(|(selector, owner)| (selector.to_owned(), owner))
                    .collect::<BTreeSet<_>>(),
                "{path} {edit:?}"
            );
        }
    }
}
