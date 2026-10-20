//! Scoped universal selectors retain exact matches while global selectors stay unresolved.

use std::collections::BTreeMap;

use mokly_model::evidence::EvidenceOwner;

use crate::match_tree::{MatchElement, MatchTree};
use crate::rule_collection::collect;
use crate::rule_matching::{DocumentMatching, match_document};
use crate::rules::diff;

fn tree() -> MatchTree {
    let element = |name: &str, parent, children, attributes| MatchElement {
        name: name.into(),
        namespace: "http://www.w3.org/1999/xhtml".into(),
        attributes,
        parent,
        children,
        text: false,
        regions: Default::default(),
        input_regions: Default::default(),
        owner: EvidenceOwner::Entry,
    };
    MatchTree {
        elements: vec![
            element(
                "section",
                None,
                vec![1, 2],
                BTreeMap::from([
                    ("class".into(), "stack".into()),
                    ("id".into(), "stack".into()),
                    ("data-stack".into(), "".into()),
                ]),
            ),
            element("i", Some(0), vec![], BTreeMap::new()),
            element("b", Some(0), vec![], BTreeMap::new()),
        ],
    }
}

fn matched(selector: &str) -> (bool, Vec<usize>) {
    let tree = tree();
    let changes = diff(
        &collect(format!("{selector}{{color:red}}").as_bytes()),
        &collect(format!("{selector}{{color:blue}}").as_bytes()),
    );
    let DocumentMatching::Resolved(rules) = match_document(&changes, None, Some(&tree)) else {
        panic!("selector fixture must parse")
    };
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].selectors.len(), 1);
    let result = &rules[0].selectors[0];
    (
        result.unresolved,
        result
            .elements
            .iter()
            .map(|element| element.element)
            .collect(),
    )
}

#[test]
fn scoped_universal_siblings_match_only_the_second_child() {
    for selector in [
        ".stack > * + *",
        "#stack > * + *",
        "[data-stack] > * + *",
        "section > * + *",
    ] {
        assert_eq!(matched(selector), (false, vec![2]), "{selector}");
    }
    assert_eq!(matched(".missing > * + *"), (false, vec![]));
}

#[test]
fn a_bare_universal_or_global_context_keeps_conservative_evidence() {
    for selector in [
        "*",
        "* + *",
        ":is(.stack, *)",
        ".stack :is(*)",
        ".stack:not(*)",
        ":is(.missing > *)",
        ":not(.missing > *)",
        ":has(.missing > *)",
        ":is([data-stack] > *)",
        ":is(#stack > *)",
        ":is(section > *)",
        "body .stack > *",
        "html .stack > *",
        ":root .stack > *",
    ] {
        assert!(matched(selector).0, "{selector}");
    }
}
