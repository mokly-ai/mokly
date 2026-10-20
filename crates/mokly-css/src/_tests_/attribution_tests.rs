//! Rule proof is joined across bundles before nested ownership and wire reduction.

use mokly_model::evidence::{EvidenceOwner, RuleStatus};

use crate::attribution::{MatchProof, PageObservation, RuleObservation, SelectorProof, attribute};
use crate::match_tree::Containment;

fn proof(stylesheet: &str, selector: &str, regions: &[(&str, bool)]) -> RuleObservation {
    RuleObservation {
        stylesheet: stylesheet.into(),
        identity: (
            Some((vec![selector.into()], "color:red".into())),
            Some((vec![selector.into()], "color:blue".into())),
        ),
        selectors: vec![SelectorProof {
            selector: selector.into(),
            unresolved: false,
            matches: vec![MatchProof {
                regions: regions
                    .iter()
                    .map(|(path, root)| Containment {
                        path: (*path).into(),
                        root: *root,
                    })
                    .collect(),
                owner: EvidenceOwner::Entry,
                input_owner_only: false,
            }],
        }],
    }
}

#[test]
fn copies_across_bundles_share_own_page_proof_but_keep_their_public_paths() {
    let pages = [
        PageObservation {
            component: Some("card".into()),
            rules: vec![proof("static/card.css", ".card", &[("card", true)])],
        },
        PageObservation {
            component: None,
            rules: vec![proof("static/home.css", ".card", &[("card", false)])],
        },
    ];
    let result = attribute(&pages);
    assert_eq!(
        result.changed_components.into_iter().collect::<Vec<_>>(),
        ["card"]
    );
    assert_eq!(result.pages[1][0].stylesheet, "static/home.css");
    assert_eq!(
        result.pages[1][0].owner,
        EvidenceOwner::Component {
            path: "card".into()
        }
    );
}

#[test]
fn unfiltered_nested_matches_take_parent_proof_without_a_fixed_point() {
    let pages = [
        PageObservation {
            component: Some("x".into()),
            rules: vec![proof("static/x.css", ".hit", &[("x", true), ("y", false)])],
        },
        PageObservation {
            component: Some("y".into()),
            rules: vec![proof("static/y.css", ".hit", &[("y", true), ("z", false)])],
        },
        PageObservation {
            component: Some("z".into()),
            rules: vec![proof("static/z.css", ".hit", &[("z", true)])],
        },
    ];
    let result = attribute(&pages);
    assert_eq!(
        result.changed_components.into_iter().collect::<Vec<_>>(),
        ["z"]
    );
    assert_eq!(result.pages[0][0].owner, EvidenceOwner::Entry);
    assert_eq!(
        result.pages[1][0].owner,
        EvidenceOwner::Component { path: "z".into() }
    );
    assert_eq!(result.component_pages.into_iter().collect::<Vec<_>>(), [2]);
}

#[test]
fn unresolved_rules_coexist_with_component_rules_and_exclusions_are_single_records() {
    let mut missing = proof("static/unused.css", ".none", &[]);
    missing.selectors[0].matches.clear();
    let mut unresolved = proof("static/card.css", "body", &[]);
    unresolved.selectors[0].unresolved = true;
    let pages = [PageObservation {
        component: Some("card".into()),
        rules: vec![
            proof("static/card.css", ".card", &[("card", true)]),
            unresolved,
            missing.clone(),
            missing,
        ],
    }];
    let result = attribute(&pages);
    assert_eq!(result.pages[0].len(), 3);
    assert_eq!(
        result.pages[0]
            .iter()
            .filter(|rule| rule.status == RuleStatus::Excluded)
            .count(),
        1
    );
    assert!(result.pages[0].iter().any(|rule| rule.status == RuleStatus::Unresolved && rule.owner == EvidenceOwner::Entry));
}

#[test]
fn a_nested_self_instance_never_takes_its_own_component_proof() {
    let pages = [PageObservation {
        component: Some("card".into()),
        rules: vec![proof(
            "static/card.css",
            ".card",
            &[("card", true), ("card", false)],
        )],
    }];
    assert!(attribute(&pages).changed_components.contains("card"));
}

#[test]
fn the_innermost_changed_component_owns_a_nested_match() {
    let pages = [
        PageObservation {
            component: Some("outer".into()),
            rules: vec![proof("static/x.css", ".hit", &[("outer", true)])],
        },
        PageObservation {
            component: Some("inner".into()),
            rules: vec![proof("static/x.css", ".hit", &[("inner", true)])],
        },
        PageObservation {
            component: None,
            rules: vec![proof(
                "static/x.css",
                ".hit",
                &[("outer", false), ("inner", false)],
            )],
        },
    ];
    let result = attribute(&pages);
    assert_eq!(result.changed_components.len(), 2);
    assert_eq!(result.pages[2].len(), 1);
    assert_eq!(
        result.pages[2][0].owner,
        EvidenceOwner::Component {
            path: "inner".into()
        }
    );
}
