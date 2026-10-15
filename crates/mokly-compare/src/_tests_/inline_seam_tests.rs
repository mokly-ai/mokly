//! Whole-screen style matching can be connected without changing linked-CSS attribution.

use std::collections::BTreeMap;

use mokly_css::inline_attribution;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_model::evidence::{EvidenceOwner, RuleStatus};

#[test]
fn inline_rules_use_one_matched_owner_and_keep_unresolved_or_excluded_entry_records() {
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "card".into())]),
            parent: None,
            children: Vec::new(),
            text: true,
            regions: vec![Containment {
                path: "card".into(),
                root: false,
            }],
            owner: EvidenceOwner::Entry,
        }],
    };
    for (selector, status, owner) in [
        (
            ".card",
            RuleStatus::Matched,
            EvidenceOwner::Component {
                path: "card".into(),
            },
        ),
        ("body", RuleStatus::Unresolved, EvidenceOwner::Entry),
        (".missing", RuleStatus::Excluded, EvidenceOwner::Entry),
    ] {
        let before = format!("{selector}{{color:red}}");
        let after = format!("{selector}{{color:blue}}");
        let matching = match_document(
            &diff(&collect(before.as_bytes()), &collect(after.as_bytes())),
            Some(&tree),
            Some(&tree),
        );
        let result = inline_attribution::attribute(
            "static/document.html",
            &matching,
            Some(&tree),
            Some(&tree),
        );
        assert_eq!(result.rules.len(), 1);
        assert_eq!(result.rules[0].status, status);
        assert_eq!(result.rules[0].owner, owner);
        assert_eq!(
            result.components.contains("card"),
            owner != EvidenceOwner::Entry
        );
    }
}
