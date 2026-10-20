//! Physical claims and supplier protection share the same catalogue reduction.

use std::collections::BTreeMap;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};

use crate::attribution::{self, PageObservation};
use crate::match_tree::{Containment, MatchElement, MatchTree};
use crate::rule_collection::collect;
use crate::rule_matching::match_document;
use crate::rules::diff;

fn page(
    component: Option<&str>,
    owner: Option<&str>,
    physical: &[(&str, bool)],
    inputs: &[(&str, bool)],
) -> PageObservation {
    let path = |items: &[(&str, bool)]| {
        items
            .iter()
            .map(|(path, root)| Containment {
                path: (*path).into(),
                root: *root,
            })
            .collect()
    };
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "hit".into())]),
            parent: None,
            children: Vec::new(),
            text: false,
            regions: path(physical),
            input_regions: path(inputs),
            owner: EvidenceOwner::Entry,
        }],
    };
    let matching = match_document(
        &diff(&collect(b".hit{color:red}"), &collect(b".hit{color:blue}")),
        Some(&tree),
        Some(&tree),
    );
    PageObservation {
        component: component.map(str::to_owned),
        rules: attribution::observe_owned("source", &matching, Some(&tree), Some(&tree), owner),
    }
}

#[test]
fn a_declared_receiver_claims_supplied_content_without_an_own_page_match() {
    let result = attribution::attribute(vec![page(
        None,
        Some("receiver"),
        &[("receiver", false)],
        &[],
    )]);
    assert_eq!(
        result.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "receiver".into()
        }
    );
    assert_eq!(result.pages[0][0].status, RuleStatus::Matched);
    assert!(result.own_pages.is_empty());
}

#[test]
fn an_unowned_receiver_needs_catalogue_proof_for_supplied_content() {
    let consumer = || page(None, None, &[("receiver", false)], &[]);
    let result = attribution::attribute(vec![consumer()]);
    assert_eq!(result.pages[0][0].owner, EvidenceOwner::Entry);
    let result = attribution::attribute(vec![
        page(Some("receiver"), None, &[("receiver", true)], &[]),
        consumer(),
    ]);
    assert_eq!(
        result.pages[1][0].owner,
        EvidenceOwner::Component {
            path: "receiver".into()
        }
    );
}

#[test]
fn a_nested_receiver_cannot_take_its_suppliers_declared_rule() {
    let result = attribution::attribute(vec![
        page(
            Some("supplier"),
            Some("supplier"),
            &[("supplier", true), ("receiver", false)],
            &[("supplier", true)],
        ),
        page(
            Some("receiver"),
            Some("receiver"),
            &[("receiver", true)],
            &[("receiver", true)],
        ),
    ]);
    assert_eq!(
        result.component_pages.into_iter().collect::<Vec<_>>(),
        [0, 1]
    );
    assert_eq!(
        result.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "supplier".into()
        }
    );
    assert_eq!(
        result.pages[1][0].owner,
        EvidenceOwner::Component {
            path: "receiver".into()
        }
    );
}

#[test]
fn nested_own_proof_takes_a_page_wide_copy_outside_supplied_content() {
    let result = attribution::attribute(vec![
        page(
            Some("supplier"),
            Some("supplier"),
            &[("supplier", true), ("receiver", false)],
            &[("supplier", true), ("receiver", false)],
        ),
        page(
            Some("receiver"),
            Some("receiver"),
            &[("receiver", true)],
            &[("receiver", true)],
        ),
    ]);
    assert_eq!(result.component_pages.into_iter().collect::<Vec<_>>(), [1]);
    assert_eq!(
        result.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "receiver".into()
        }
    );
}
