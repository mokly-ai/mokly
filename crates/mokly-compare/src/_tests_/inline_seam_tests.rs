//! Whole-screen style matching can be connected without changing linked-CSS attribution.

use std::collections::BTreeMap;

use mokly_css::attribution::{self, PageObservation};
use mokly_css::inline_attribution;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_model::evidence::{EvidenceOwner, RuleStatus};

#[test]
fn inline_rules_without_own_page_proof_keep_entry_records() {
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
            }]
            .into_iter()
            .collect(),
            owner: EvidenceOwner::Entry,
        }],
    };
    for (selector, status, owner) in [
        (".card", RuleStatus::Matched, EvidenceOwner::Entry),
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
        let observations = inline_attribution::observe(
            "static/document.html",
            &matching,
            Some(&tree),
            Some(&tree),
        );
        let result = attribution::attribute(&[PageObservation {
            component: None,
            rules: observations,
        }]);
        let rules = &result.pages[0];
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].status, status);
        assert_eq!(rules[0].owner, owner);
        assert_eq!(
            result.changed_components.contains("card"),
            owner != EvidenceOwner::Entry
        );
    }
}

#[test]
fn inline_own_page_proof_joins_rule_identity_across_document_routes() {
    let tree = |root, owner| MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "card".into())]),
            parent: None,
            children: Vec::new(),
            text: true,
            regions: vec![Containment {
                path: "card".into(),
                root,
            }]
            .into_iter()
            .collect(),
            owner,
        }],
    };
    let component = EvidenceOwner::Component {
        path: "card".into(),
    };
    let own = tree(true, component.clone());
    let consumer = tree(false, component.clone());
    let slot = tree(false, EvidenceOwner::Entry);
    let diff = diff(
        &collect(b".card{color:red}"),
        &collect(b".card{color:blue}"),
    );
    let pages: Vec<_> = [
        (&own, "own", Some("card".into())),
        (&consumer, "consumer", None),
        (&slot, "slot", None),
    ]
    .into_iter()
    .map(|(tree, route, component)| PageObservation {
        component,
        rules: inline_attribution::observe(
            route,
            &match_document(&diff, Some(tree), Some(tree)),
            Some(tree),
            Some(tree),
        ),
    })
    .collect();
    let result = attribution::attribute(&pages);
    assert_eq!(
        result.changed_components.into_iter().collect::<Vec<_>>(),
        ["card"]
    );
    assert_eq!(result.pages[1][0].owner, component);
    assert_eq!(result.pages[1][0].stylesheet, "consumer");
    assert_eq!(result.pages[2][0].owner, EvidenceOwner::Entry);
}
