//! Region entry and exit restore both containment and supplied-input ownership.

use std::collections::BTreeMap;
use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

use super::document;

fn region(kind: RegionKind, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: String::new(),
            kind,
        },
        children,
    }
}

#[test]
fn ownership_and_containment_restore_after_each_region_and_element() {
    let nodes = vec![
        region(
            RegionKind::Instance {
                key: "key".into(),
                path: "old".into(),
                local_id: "id".into(),
                props_key: "props".into(),
            },
            vec![tree::element(
                "article",
                &[],
                vec![
                    region(
                        RegionKind::Slot {
                            key: "slot".into(),
                            instance_key: "key".into(),
                            name: "children".into(),
                            owner: ComponentInputOwner::Entry,
                        },
                        vec![tree::element("b", &[], vec![Node::Text("slot".into())])],
                    ),
                    tree::element("i", &[], vec![]),
                ],
            )],
        ),
        tree::element("p", &[], vec![]),
    ];
    let tree = document(&nodes, &[("old".into(), "new".into())].into());
    assert!(tree.valid());
    assert_eq!(
        tree.elements
            .iter()
            .map(|element| element.name.as_str())
            .collect::<Vec<_>>(),
        ["article", "b", "i", "p"]
    );
    assert_eq!(tree.elements[0].children, [1, 2]);
    assert_eq!(tree.elements[1].owner, EvidenceOwner::Entry);
    assert!(tree.elements[1].text);
    assert_eq!(
        tree.elements[2].owner,
        EvidenceOwner::Component { path: "new".into() }
    );
    assert_eq!(tree.elements[2].regions[0].path, "new");
    assert_eq!(tree.elements[3].owner, EvidenceOwner::Entry);
    assert!(tree.elements[3].regions.is_empty());
}

#[test]
fn deep_regions_and_elements_use_a_heap_walk_and_restore_sibling_scope() {
    thread::spawn(|| {
        let mut nodes = vec![tree::element("span", &[], vec![])];
        for index in 0..20_000 {
            nodes = vec![region(
                RegionKind::Root {
                    path: index.to_string(),
                },
                nodes,
            )];
        }
        nodes.push(tree::element("footer", &[], vec![]));
        let tree = document(&nodes, &BTreeMap::new());
        assert_eq!(tree.elements.len(), 2);
        assert_eq!(tree.elements[0].regions.len(), 20_000);
        assert_eq!(tree.elements[0].regions[0].path, "19999");
        assert_eq!(tree.elements[0].regions[19_999].path, "0");
        assert!(tree.elements[1].regions.is_empty());
    })
    .join()
    .unwrap();
}

#[test]
fn repeated_component_paths_use_the_exact_slot_supplier_instance() {
    let instance = |key: &str, path: &str, children| {
        region(
            RegionKind::Instance {
                key: key.into(),
                path: path.into(),
                local_id: key.into(),
                props_key: "props".into(),
            },
            children,
        )
    };
    let slot = region(
        RegionKind::Slot {
            key: "slot".into(),
            instance_key: "inner".into(),
            name: "children".into(),
            owner: ComponentInputOwner::Instance {
                instance_key: "outer".into(),
            },
        },
        vec![tree::element("b", &[], vec![])],
    );
    let nodes = vec![instance(
        "outer",
        "parent",
        vec![instance(
            "child",
            "child",
            vec![instance(
                "inner",
                "parent",
                vec![slot, tree::element("i", &[], vec![])],
            )],
        )],
    )];
    let tree = document(&nodes, &BTreeMap::new());
    let paths = |index: usize| {
        tree.elements[index]
            .input_regions
            .iter()
            .map(|region| region.path.as_str())
            .collect::<Vec<_>>()
    };
    assert_eq!(paths(0), ["parent"]);
    assert_eq!(paths(1), ["parent", "child", "parent"]);
    assert_eq!(tree.elements[0].regions.len(), 3);
    assert_eq!(
        tree.elements[0].owner,
        EvidenceOwner::Component {
            path: "parent".into()
        }
    );
}
