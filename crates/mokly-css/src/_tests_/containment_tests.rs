//! Shared prefixes preserve ancestry and release deep paths without recursive destruction.

use std::collections::BTreeMap;
use std::ptr;
use std::thread;

use mokly_model::evidence::EvidenceOwner;

use crate::attribution::{self, PageObservation};
use crate::inline_attribution;
use crate::rule_collection::collect;
use crate::rule_matching::match_document;
use crate::rules::diff;

use crate::match_tree::{Containment, MatchElement, MatchTree};

use super::ContainmentPath;

fn region(path: &str) -> Containment {
    Containment {
        path: path.into(),
        root: false,
    }
}

#[test]
fn siblings_share_their_prefix_and_clones_keep_original_storage_alive() {
    let parent = ContainmentPath::default().with_region(region("parent"));
    let left = parent.with_region(region("left"));
    let right = parent.with_region(region("right"));
    assert!(ptr::eq(
        left.iter().nth(1).unwrap(),
        right.iter().nth(1).unwrap()
    ));
    let kept = {
        let temporary = left.clone();
        assert!(ptr::eq(
            temporary.iter().next().unwrap(),
            left.iter().next().unwrap()
        ));
        temporary.clone()
    };
    assert_eq!(
        kept.iter()
            .map(|region| region.path.as_str())
            .collect::<Vec<_>>(),
        ["left", "parent"]
    );
    assert_eq!(
        right
            .iter()
            .map(|region| region.path.as_str())
            .collect::<Vec<_>>(),
        ["right", "parent"]
    );
    assert_eq!(parent.len(), 1);
    assert!(!parent.is_empty());
    assert!(ContainmentPath::default().is_empty());
}

#[test]
fn final_deep_path_owner_releases_on_an_ordinary_stack() {
    thread::spawn(|| {
        let retained = {
            let mut path = ContainmentPath::default();
            for _ in 0..100_000 {
                path = path.with_region(region("nested"));
            }
            let copy = path.clone();
            assert_eq!(copy.len(), 100_000);
            copy
        };
        assert_eq!(retained.iter().count(), 100_000);
    })
    .join()
    .unwrap();
}

#[test]
fn linked_and_inline_proof_share_storage_after_the_tree_is_released() {
    let (linked, inline) = {
        let regions: ContainmentPath = [
            Containment {
                path: "parent".into(),
                root: true,
            },
            region("child"),
        ]
        .into_iter()
        .collect();
        let tree = MatchTree {
            elements: vec![MatchElement {
                name: "p".into(),
                namespace: "http://www.w3.org/1999/xhtml".into(),
                attributes: BTreeMap::from([("class".into(), "hit".into())]),
                parent: None,
                children: vec![],
                text: false,
                input_regions: Default::default(),
                regions,
                owner: EvidenceOwner::Entry,
            }],
        };
        let clone = tree.clone();
        let matching = match_document(
            &diff(&collect(b".hit{color:red}"), &collect(b".hit{color:blue}")),
            Some(&tree),
            Some(&clone),
        );
        let linked = attribution::observe("sheet.css", &matching, Some(&tree), Some(&clone));
        let inline = inline_attribution::observe("page.html", &matching, Some(&tree), Some(&clone));
        let original = tree.elements[0].regions.iter().next().unwrap();
        assert_eq!(linked[0].selectors[0].matches.len(), 2);
        for proof in &linked[0].selectors[0].matches {
            assert!(ptr::eq(original, proof.regions().next().unwrap()));
            assert_eq!(proof.regions().count(), 2);
        }
        assert_eq!(inline[0].selectors[0].matches.len(), 2);
        for proof in &inline[0].selectors[0].matches {
            assert!(ptr::eq(original, proof.regions().next().unwrap()));
            assert_eq!(proof.regions().count(), 2);
        }
        (linked, inline)
    };
    let page = |rules| PageObservation {
        component: Some("parent".into()),
        rules,
    };
    let linked = attribution::attribute(vec![page(linked)]);
    let inline = attribution::attribute(vec![page(inline)]);
    assert_eq!(
        linked.changed_components.into_iter().collect::<Vec<_>>(),
        ["parent"]
    );
    assert_eq!(
        linked.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "parent".into()
        }
    );
    assert_eq!(
        inline.changed_components.into_iter().collect::<Vec<_>>(),
        ["parent"]
    );
    assert_eq!(
        inline.pages[0][0].owner,
        EvidenceOwner::Component {
            path: "parent".into()
        }
    );
}
