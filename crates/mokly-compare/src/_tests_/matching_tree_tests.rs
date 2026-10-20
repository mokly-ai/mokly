//! Region entry and exit restore both containment and supplied-input ownership.

use std::collections::{BTreeMap, BTreeSet};
use std::ptr;
use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

use super::{document, embedded};

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
    assert_eq!(tree.elements[2].regions.iter().next().unwrap().path, "new");
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
        assert_eq!(
            tree.elements[0].regions.iter().last().unwrap().path,
            "19999"
        );
        assert_eq!(tree.elements[0].regions.iter().next().unwrap().path, "0");
        assert!(tree.elements[1].regions.is_empty());
    })
    .join()
    .unwrap();
}

#[test]
fn nested_element_containment_storage_grows_with_regions_not_depth_times_elements() {
    fn storage(depth: usize) -> usize {
        let mut nodes = vec![tree::element("span", &[], vec![])];
        for index in 0..depth {
            nodes = vec![region(
                RegionKind::Instance {
                    key: format!("key-{index}"),
                    path: format!("component-{index}"),
                    local_id: "id".into(),
                    props_key: "props".into(),
                },
                vec![tree::element("section", &[], nodes)],
            )];
        }
        let tree = document(&nodes, &BTreeMap::new());
        assert!(tree.valid());
        assert_eq!(tree.elements.len(), depth + 1);
        assert_eq!(tree.elements.last().unwrap().regions.len(), depth);
        let mut regions = BTreeSet::new();
        for (index, element) in tree.elements.iter().enumerate() {
            let expected = (index + 1).min(depth);
            assert_eq!(element.regions.len(), expected);
            for region in element.regions.iter() {
                regions.insert(region as *const _ as usize);
            }
        }
        regions.len()
    }
    let small = storage(128);
    let large = storage(512);
    assert!(small > 0);
    assert!(
        large * 2 <= small * 9,
        "containment allocations: {small} -> {large}"
    );
    assert_eq!((small, large), (128, 512));
}

#[test]
fn embedded_documents_share_and_retain_the_enclosing_component_path() {
    let embedded = {
        let tree = document(
            &[region(
                RegionKind::Root {
                    path: "card".into(),
                },
                vec![tree::element("iframe", &[], vec![])],
            )],
            &BTreeMap::new(),
        );
        let frame = &tree.elements[0];
        let embedded = embedded(
            &[tree::element("p", &[], vec![])],
            &frame.regions,
            &frame.owner,
        );
        assert!(ptr::eq(
            frame.regions.iter().next().unwrap(),
            embedded.elements[0].regions.iter().next().unwrap(),
        ));
        embedded
    };
    assert!(embedded.valid());
    assert_eq!(embedded.elements[0].regions.len(), 1);
    let region = embedded.elements[0].regions.iter().next().unwrap();
    assert_eq!(region.path, "card");
    assert!(region.root);
    assert_eq!(
        embedded.elements[0].owner,
        EvidenceOwner::Component {
            path: "card".into()
        }
    );
}
