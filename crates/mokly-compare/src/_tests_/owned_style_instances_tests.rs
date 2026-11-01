//! Owned style proof keeps only matched instance ancestry.

use std::collections::{BTreeMap, BTreeSet};
use std::thread;

use mokly_css::rule_matching::{DocumentMatching, ElementMatch, MatchedRule, SelectorMatch};
use mokly_css::rules::RuleChange;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::ComponentInputOwner;

use crate::owned_style_chain_source::DocumentIndex;
use crate::owned_style_instances;

use super::{Compact, matched};

fn compact(
    nodes: [&[Node]; 2],
    paths: &BTreeMap<String, String>,
    matching: &DocumentMatching,
    owner: &str,
) -> Compact {
    let documents = [
        DocumentIndex::build(nodes[0], paths),
        DocumentIndex::build(nodes[1], &BTreeMap::new()),
    ];
    let candidates = documents
        .iter()
        .flat_map(|document| &document.instances)
        .filter(|instance| instance.path == owner)
        .map(|instance| instance.key.as_str())
        .collect();
    owned_style_instances::compact(&documents, matching, owner, &candidates)
}

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

fn matching(element: usize) -> DocumentMatching {
    DocumentMatching::Resolved(vec![MatchedRule {
        change: RuleChange {
            before: None,
            after: None,
        },
        selectors: vec![SelectorMatch {
            selector: "b".into(),
            unresolved: false,
            elements: vec![ElementMatch {
                side: ReviewSide::Before,
                element,
            }],
        }],
    }])
}

#[test]
fn shared_chains_keep_selector_matches_and_exclude_inert_or_empty_instances() {
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
    let paths = [("old".into(), "new".into())].into();
    let source = DocumentIndex::build(&nodes, &paths);
    assert_eq!(source.elements.len(), 4);
    assert_eq!(source.instances.len(), 3);
    let unresolved = compact(
        [&nodes, &[]],
        &paths,
        &DocumentMatching::Unresolved(vec![]),
        "new",
    );
    assert!(matched(&unresolved, "new", &BTreeMap::new()).is_empty());
    let chains = compact([&nodes, &[]], &paths, &matching(1), "new");
    assert_eq!(
        matched(&chains, "new", &BTreeMap::new()),
        BTreeSet::from(["outer".into(), "inner".into()])
    );
    assert!(matched(&chains, "old", &BTreeMap::new()).is_empty());
    let chains = compact([&nodes, &[]], &paths, &matching(0), "new");
    assert_eq!(
        matched(&chains, "new", &BTreeMap::new()),
        BTreeSet::from(["outer".into()])
    );
    let chains = compact([&nodes, &[]], &paths, &matching(3), "new");
    assert!(matched(&chains, "new", &BTreeMap::new()).is_empty());
    let mut unresolved = matching(1);
    if let DocumentMatching::Resolved(rules) = &mut unresolved {
        rules[0].selectors[0].unresolved = true;
    }
    let chains = compact([&nodes, &[]], &paths, &unresolved, "new");
    assert!(matched(&chains, "new", &BTreeMap::new()).is_empty());
}

#[test]
fn duplicate_selector_matches_share_one_chain_start() {
    let nodes = vec![instance(
        "owner",
        vec![
            tree::element("b", &[], vec![]),
            tree::element("b", &[], vec![]),
        ],
    )];
    let mut matching = matching(0);
    if let DocumentMatching::Resolved(rules) = &mut matching {
        rules[0].selectors[0].elements.push(ElementMatch {
            side: ReviewSide::Before,
            element: 1,
        });
        rules.push(rules[0].clone());
    }
    let chains = compact([&nodes, &[]], &BTreeMap::new(), &matching, "old");
    assert_eq!(chains.counts(), (1, 1));
    assert_eq!(
        matched(&chains, "old", &BTreeMap::new()),
        BTreeSet::from(["owner".into()])
    );
}

#[test]
fn nested_owner_copies_keep_their_own_physical_chain() {
    let nodes = vec![instance(
        "outer",
        vec![instance("inner", vec![tree::element("b", &[], vec![])])],
    )];
    let chains = compact([&nodes, &[]], &BTreeMap::new(), &matching(0), "old");
    assert_eq!(
        matched(&chains, "old", &BTreeMap::new()),
        BTreeSet::from(["outer".into(), "inner".into()])
    );
}

#[test]
fn slot_input_owner_uses_the_supplier_chain_for_blocking() {
    let nodes = vec![instance(
        "outer",
        vec![instance(
            "owner",
            vec![Node::Region {
                region: Region {
                    id: "slot".into(),
                    kind: RegionKind::Slot {
                        key: "slot".into(),
                        instance_key: "outer".into(),
                        name: "children".into(),
                        owner: ComponentInputOwner::Instance {
                            instance_key: "outer".into(),
                        },
                    },
                },
                children: vec![tree::element("b", &[], vec![])],
            }],
        )],
    )];
    let chains = compact([&nodes, &[]], &BTreeMap::new(), &matching(0), "old");
    assert_eq!(
        matched(&chains, "old", &BTreeMap::new()),
        BTreeSet::from(["owner".into(), "outer".into()])
    );
}

#[test]
fn own_page_match_blocks_an_outer_owner_chain() {
    let nodes = vec![Node::Region {
        region: Region {
            id: "outer".into(),
            kind: RegionKind::Instance {
                path: "owner".into(),
                key: "outer".into(),
                local_id: "outer".into(),
                props_key: "props".into(),
            },
        },
        children: vec![Node::Region {
            region: Region {
                id: "inner".into(),
                kind: RegionKind::Instance {
                    path: "other".into(),
                    key: "inner".into(),
                    local_id: "inner".into(),
                    props_key: "props".into(),
                },
            },
            children: vec![Node::Region {
                region: Region {
                    id: "slot".into(),
                    kind: RegionKind::Slot {
                        key: "slot".into(),
                        instance_key: "inner".into(),
                        name: "children".into(),
                        owner: ComponentInputOwner::Instance {
                            instance_key: "inner".into(),
                        },
                    },
                },
                children: vec![tree::element("b", &[], vec![])],
            }],
        }],
    }];
    let chains = compact([&nodes, &[]], &BTreeMap::new(), &matching(0), "owner");
    let identity = (None, None);
    let own_pages = BTreeMap::from([(identity, BTreeSet::from(["other".into()]))]);
    assert_eq!(
        matched(&chains, "owner", &BTreeMap::new()),
        BTreeSet::from(["outer".into()])
    );
    assert!(matched(&chains, "owner", &own_pages).is_empty());
}

#[test]
fn deep_nested_instances_retain_only_the_matched_chain() {
    thread::spawn(|| {
        let mut nodes = vec![tree::element("b", &[], vec![])];
        for level in 0..20_000 {
            nodes = vec![instance(&level.to_string(), nodes)];
        }
        let source = DocumentIndex::build(&nodes, &BTreeMap::new());
        assert_eq!(source.instances.len(), 20_000);
        assert_eq!(source.elements.len(), 1);
        let chains = compact([&nodes, &[]], &BTreeMap::new(), &matching(0), "old");
        assert_eq!(chains.counts(), (20_000, 1));
        assert_eq!(matched(&chains, "old", &BTreeMap::new()).len(), 20_000);
    })
    .join()
    .unwrap();
}
