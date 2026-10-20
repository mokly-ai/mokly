//! Count retained ancestry clones at the observation ownership boundary.

use std::cell::Cell;
use std::collections::BTreeMap;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};

use crate::attribution::{self, PageObservation};
use crate::match_tree::{Containment, MatchElement, MatchTree};
use crate::rule_collection::collect;
use crate::rule_matching::match_document;
use crate::rules::diff;

use super::ContainmentPath;

thread_local! {
    static CLONES: Cell<usize> = const { Cell::new(0) };
}

pub(super) fn record() {
    CLONES.with(|count| count.set(count.get() + 1));
}

#[test]
fn attribution_consumes_observations_without_cloning_their_ancestry() {
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "hit".into())]),
            parent: None,
            children: Vec::new(),
            text: false,
            regions: ContainmentPath::default().with_region(Containment {
                instance: None,
                path: "card".into(),
                root: true,
            }),
            input_regions: ContainmentPath::default(),
            owner: EvidenceOwner::Entry,
        }],
    };
    CLONES.with(|count| count.set(0));
    let matching = match_document(
        &diff(&collect(b".hit{color:red}"), &collect(b".hit{color:blue}")),
        Some(&tree),
        Some(&tree),
    );
    let page = PageObservation {
        component: Some("card".into()),
        rules: attribution::observe("sheet.css", &matching, Some(&tree), Some(&tree)),
    };
    assert_eq!(
        CLONES.with(Cell::get),
        2,
        "both sides retain one path handle"
    );
    CLONES.with(|count| count.set(0));
    let result = attribution::attribute(vec![page]);
    assert_eq!(result.pages[0].len(), 1);
    assert_eq!(result.pages[0][0].status, RuleStatus::Matched);
    assert_eq!(
        result.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "card".into()
        }
    );
    assert_eq!(
        CLONES.with(Cell::get),
        0,
        "the reducer must move the retained paths"
    );
}
