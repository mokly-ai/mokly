//! Own-view CSS impact uses kept source proof independently of nested ownership records.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::attribution::{self, PageObservation};
use mokly_css::containment::ContainmentPath;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_model::axes::ColorScheme;
use mokly_model::evidence::{EvidenceOwner, ViewEvidence};
use mokly_model::review::ReviewState;

use crate::comparison_types::{DocumentComparison, ViewKey};
use crate::comparison_views::PendingView;
use crate::implementation::OwnImpact;

use super::{ViewInput, apply};

fn page(component: &str, regions: &[(&str, bool)], source: &str) -> PageObservation {
    let regions: ContainmentPath = regions
        .iter()
        .map(|(path, root)| Containment {
            instance: None,
            path: (*path).into(),
            root: *root,
        })
        .collect();
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "hit".into())]),
            parent: None,
            children: vec![],
            text: false,
            input_regions: regions.clone(),
            regions,
            owner: EvidenceOwner::Entry,
        }],
    };
    let matching = match_document(
        &diff(
            &collect(b".hit{margin-left:1px}"),
            &collect(b".hit{margin-left:2px}"),
        ),
        Some(&tree),
        Some(&tree),
    );
    PageObservation {
        component: Some(component.into()),
        rules: attribution::observe_owned(
            source,
            &matching,
            Some(&tree),
            Some(&tree),
            Some(component),
        ),
    }
}

fn check(mixed: bool) {
    let mut x = page("x", &[("x", true), ("y", false), ("x", false)], "document");
    if mixed {
        x.rules.extend(page("x", &[("x", true)], "own.css").rules);
    }
    let attributed = attribution::attribute(vec![x, page("y", &[("y", true)], "y-document")]);
    assert_eq!(attributed.component_pages.contains(&0), mixed);
    let mut view = PendingView {
        document: DocumentComparison {
            key: ViewKey {
                viewport: None,
                color_scheme: ColorScheme::Light,
            },
            before_route: Some("document".into()),
            after_route: Some("document".into()),
            state: ReviewState::Unchanged,
            ignored_ids: vec![],
            evidence: ViewEvidence {
                rules: vec![],
                resources: vec![],
            },
        },
        observation: PageObservation::default(),
        material: false,
        inputs: false,
        structure: false,
        root_changed: false,
        rule_sources: BTreeSet::new(),
        proofs: vec![],
        owned: Default::default(),
    };
    let mut impact = BTreeSet::new();
    let mut own = OwnImpact::default();
    apply(
        &mut view,
        ViewInput {
            attributed: &attributed,
            index: 0,
            component: Some("x"),
            same_inputs: true,
        },
        &mut impact,
        &mut own,
        &mut vec![],
    );
    assert_eq!(
        view.document.state,
        if mixed {
            ReviewState::Changed
        } else {
            ReviewState::Unchanged
        }
    );
    assert_eq!(impact.contains("x"), mixed);
    assert_eq!(
        own.dependencies,
        if mixed {
            BTreeSet::from([("x".into(), "own.css".into())])
        } else {
            BTreeSet::new()
        }
    );
    assert!(
        view.document
            .evidence
            .rules
            .iter()
            .any(|rule| rule.stylesheet == "document"
                && rule.owner == EvidenceOwner::Component { path: "x".into() })
    );
}

#[test]
fn nested_instance_records_do_not_promote_rejected_own_page_matches() {
    check(false);
}

#[test]
fn kept_source_proof_does_not_promote_a_different_nested_only_source() {
    check(true);
}
