//! Instance ancestry is shared while selectors keep all enclosing matching owners.

use std::collections::{BTreeMap, BTreeSet};
use std::thread;

use mokly_css::rule_matching::{DocumentMatching, ElementMatch, MatchedRule, SelectorMatch};
use mokly_css::rules::RuleChange;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::review_affected::ReviewSide;

use super::{index, matched};

fn instance(key: &str, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: key.into(),
            kind: RegionKind::Instance {
                path: "old".into(),
                key: key.into(),
                local_id: key.into(),
                props_key: "props".into(),
            },
        },
        children,
    }
}

#[test]
fn shared_chains_keep_selector_indices_and_exclude_inert_or_empty_instances() {
    let nodes = vec![
        instance(
            "outer",
            vec![
                tree::element("p", &[], vec![]),
                instance("inner", vec![tree::element("b", &[], vec![])]),
                tree::element(
                    "template",
                    &[],
                    vec![instance("inert", vec![tree::element("i", &[], vec![])])],
                ),
                instance("empty", vec![]),
            ],
        ),
        tree::element("footer", &[], vec![]),
    ];
    let indices = [
        index(&nodes, &[("old".into(), "new".into())].into()),
        index(&[], &BTreeMap::new()),
    ];
    assert_eq!(indices[0].elements.len(), 4);
    assert_eq!(indices[0].instances.len(), 3);
    assert_eq!(
        matched(
            &DocumentMatching::Unresolved(vec![]),
            "new",
            &indices,
            &BTreeMap::new()
        ),
        BTreeSet::new()
    );
    let mut matching = DocumentMatching::Resolved(vec![MatchedRule {
        change: RuleChange {
            before: None,
            after: None,
        },
        selectors: vec![SelectorMatch {
            selector: "b".into(),
            unresolved: false,
            elements: vec![ElementMatch {
                side: ReviewSide::Before,
                element: 1,
            }],
        }],
    }]);
    assert_eq!(
        matched(&matching, "new", &indices, &BTreeMap::new()),
        BTreeSet::from(["outer".into(), "inner".into()])
    );
    assert!(matched(&matching, "old", &indices, &BTreeMap::new()).is_empty());
    if let DocumentMatching::Resolved(rules) = &mut matching {
        rules[0].selectors[0].elements[0].element = 0;
    }
    assert_eq!(
        matched(&matching, "new", &indices, &BTreeMap::new()),
        BTreeSet::from(["outer".into()])
    );
    if let DocumentMatching::Resolved(rules) = &mut matching {
        rules[0].selectors[0].elements[0].element = 3;
    }
    assert!(matched(&matching, "new", &indices, &BTreeMap::new()).is_empty());
    if let DocumentMatching::Resolved(rules) = &mut matching {
        rules[0].selectors[0].unresolved = true;
        rules[0].selectors[0].elements[0].element = 1;
    }
    assert_eq!(
        matched(&matching, "new", &indices, &BTreeMap::new()),
        BTreeSet::new()
    );
}

#[test]
fn deep_nested_instances_retain_one_link_per_region_and_one_index_per_element() {
    thread::spawn(|| {
        let mut nodes = vec![tree::element("b", &[], vec![])];
        for level in 0..20_000 {
            nodes = vec![instance(&level.to_string(), nodes)];
        }
        let index = index(&nodes, &BTreeMap::new());
        assert_eq!(index.instances.len(), 20_000);
        assert_eq!(index.elements.len(), 1);
        assert_eq!(
            matched(
                &DocumentMatching::Resolved(vec![MatchedRule {
                    change: RuleChange {
                        before: None,
                        after: None
                    },
                    selectors: vec![SelectorMatch {
                        selector: "b".into(),
                        unresolved: false,
                        elements: vec![ElementMatch {
                            side: ReviewSide::Before,
                            element: 0
                        }],
                    }],
                }]),
                "old",
                &[index, Default::default()],
                &BTreeMap::new()
            )
            .len(),
            20_000
        );
    })
    .join()
    .unwrap();
}
