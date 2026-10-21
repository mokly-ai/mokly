//! Exact instance identity distinguishes receiving copies from slot suppliers.

use std::collections::BTreeMap;

use mokly_css::attribution::{self, PageObservation};
use mokly_css::match_tree::MatchTree;
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

use super::document;

#[test]
fn repeated_component_paths_do_not_confuse_supplier_and_receiving_instances() {
    let instance = |key: &str, path: &str, children| Node::Region {
        region: Region {
            id: key.into(),
            kind: RegionKind::Instance {
                key: key.into(),
                path: path.into(),
                local_id: key.into(),
                props_key: "props".into(),
            },
        },
        children,
    };
    let nodes = vec![instance(
        "outer",
        "parent",
        vec![instance(
            "receiver",
            "child",
            vec![instance(
                "inner",
                "parent",
                vec![Node::Region {
                    region: Region {
                        id: "slot".into(),
                        kind: RegionKind::Slot {
                            key: "slot".into(),
                            instance_key: "inner".into(),
                            name: "children".into(),
                            owner: ComponentInputOwner::Instance {
                                instance_key: "outer".into(),
                            },
                        },
                    },
                    children: vec![tree::element("span", &[("class", "hit")], vec![])],
                }],
            )],
        )],
    )];
    let own = document(
        &[Node::Region {
            region: Region {
                id: "root".into(),
                kind: RegionKind::Root {
                    path: "parent".into(),
                },
            },
            children: vec![tree::element("p", &[("class", "hit")], vec![])],
        }],
        &BTreeMap::new(),
    );
    let nested = document(&nodes, &BTreeMap::new());
    let changes = diff(
        &collect(b".hit{margin-left:1px}"),
        &collect(b".hit{margin-left:2px}"),
    );
    let page = |tree: &MatchTree, component: Option<&str>, owner| PageObservation {
        component: component.map(str::to_owned),
        rules: attribution::observe_owned(
            "document",
            &match_document(&changes, Some(tree), Some(tree)),
            Some(tree),
            Some(tree),
            owner,
        ),
    };
    let result = attribution::attribute(vec![
        page(&own, Some("parent"), Some("parent")),
        page(&nested, None, Some("child")),
    ]);
    assert_eq!(
        result.pages[1][0].owner,
        EvidenceOwner::Component {
            path: "child".into()
        }
    );
}
