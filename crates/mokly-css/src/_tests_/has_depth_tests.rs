//! Deep document matching preserves other selectors and keeps :has() unresolved.

use std::collections::BTreeMap;

use mokly_model::evidence::EvidenceOwner;

use crate::match_tree::{MatchElement, MatchTree};
use crate::rule_collection::collect;
use crate::rule_matching::{DocumentMatching, match_document};
use crate::rules::diff;

fn chain(depth: usize) -> MatchTree {
    MatchTree {
        elements: (0..depth)
            .map(|index| MatchElement {
                name: "div".into(),
                namespace: "http://www.w3.org/1999/xhtml".into(),
                attributes: BTreeMap::from([(
                    "class".into(),
                    if index == 0 { "root" } else { "leaf" }.into(),
                )]),
                parent: index.checked_sub(1),
                children: if index + 1 < depth {
                    vec![index + 1]
                } else {
                    vec![]
                },
                text: false,
                regions: vec![],
                owner: EvidenceOwner::Entry,
            })
            .collect(),
    }
}

#[test]
fn has_is_unresolved_only_above_the_matching_tree_limit_on_either_side() {
    let shallow = chain(512);
    let deep = chain(513);
    for selector in [
        ".root:has(.absent)",
        r".root:h\61 s(.absent)",
        ".root:not(:has(.absent))",
    ] {
        let change = diff(
            &collect(format!("{selector}{{color:red}}").as_bytes()),
            &collect(format!("{selector}{{color:blue}}").as_bytes()),
        );
        for (before, after, unresolved) in [
            (Some(&shallow), Some(&shallow), false),
            (Some(&deep), Some(&shallow), true),
            (Some(&shallow), Some(&deep), true),
            (None, Some(&deep), true),
            (Some(&deep), None, true),
        ] {
            let DocumentMatching::Resolved(rules) = match_document(&change, before, after) else {
                panic!("expected per-rule matching")
            };
            assert_eq!(rules.len(), 1);
            assert_eq!(rules[0].selectors[0].unresolved, unresolved, "{selector}");
            if unresolved {
                assert!(rules[0].selectors[0].elements.is_empty());
            }
        }
    }
}

#[test]
fn has_text_in_attribute_values_does_not_trigger_the_depth_fallback() {
    let tree = chain(513);
    let change = diff(
        &collect(b"[title=':has(']{color:red}"),
        &collect(b"[title=':has(']{color:blue}"),
    );
    let DocumentMatching::Resolved(rules) = match_document(&change, Some(&tree), Some(&tree))
    else {
        panic!()
    };
    assert!(!rules[0].selectors[0].unresolved);
    assert!(rules[0].selectors[0].elements.is_empty());
}

#[test]
fn very_deep_pages_keep_relational_evidence_and_match_other_selectors() {
    std::thread::spawn(|| {
        let tree = chain(100_000);
        let change = diff(
            &collect(b".root:has(.absent),.root{color:red}"),
            &collect(b".root:has(.absent),.root{color:blue}"),
        );
        let DocumentMatching::Resolved(rules) = match_document(&change, Some(&tree), Some(&tree))
        else {
            panic!()
        };
        assert!(rules[0].selectors[0].unresolved);
        assert!(rules[0].selectors[0].elements.is_empty());
        assert!(!rules[0].selectors[1].unresolved);
        assert_eq!(rules[0].selectors[1].elements.len(), 2);
    })
    .join()
    .unwrap();
}
