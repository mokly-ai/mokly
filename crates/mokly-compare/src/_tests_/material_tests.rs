//! Deep canonical values preserve topology, text boundaries, and caller-owned slots.

use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::usage::ComponentInputOwner;

use crate::material_traits::fingerprint;
use crate::move_text;

use super::{Material, Projection, canonical};

fn region(kind: RegionKind, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: String::new(),
            kind,
        },
        children,
    }
}

fn wrap(mut nodes: Vec<Node>) -> Vec<Node> {
    for _ in 0..20_000 {
        nodes = vec![tree::element("span", &[], nodes)];
    }
    nodes
}

#[test]
fn deep_values_compare_hash_and_drop_without_using_tree_depth_as_stack_depth() {
    thread::spawn(|| {
        let left = canonical(
            &wrap(vec![Node::Text("leaf".into())]),
            &Projection::default(),
        );
        let same = canonical(
            &wrap(vec![Node::Text("leaf".into())]),
            &Projection::default(),
        );
        let changed = canonical(
            &wrap(vec![Node::Text("edit".into())]),
            &Projection::default(),
        );
        assert!(left == same);
        assert!(left != changed);
        assert_eq!(fingerprint(&left).unwrap(), fingerprint(&same).unwrap());
        assert_ne!(fingerprint(&left).unwrap(), fingerprint(&changed).unwrap());
        assert_eq!(move_text::page(&left), ["leaf"]);
    })
    .join()
    .unwrap();
}

#[test]
fn scanning_deep_instance_children_keeps_raw_slot_text_and_first_placement() {
    thread::spawn(|| {
        let slot = |text: &str| {
            region(
                RegionKind::Slot {
                    key: "slot".into(),
                    instance_key: "instance".into(),
                    name: "children".into(),
                    owner: ComponentInputOwner::Entry,
                },
                vec![Node::Text(text.into())],
            )
        };
        let instance = region(
            RegionKind::Instance {
                key: "instance".into(),
                path: "card".into(),
                local_id: "local".into(),
                props_key: "props".into(),
            },
            wrap(vec![tree::element(
                "pre",
                &[],
                vec![slot("  raw\n text"), slot("duplicate")],
            )]),
        );
        let projection = Projection {
            instances: ["instance".into()].into(),
            ..Default::default()
        };
        let material = canonical(&[instance], &projection);
        assert!(
            material
                == vec![
                    Material::Instance(
                        "instance".into(),
                        "card".into(),
                        "local".into(),
                        "props".into(),
                        vec![]
                    ),
                    Material::Slot("slot".into(), vec![Material::Text("  raw\n text".into())]),
                ]
        );
    })
    .join()
    .unwrap();
}

#[test]
fn transparent_regions_keep_their_text_merge_boundaries_and_ignore_order() {
    let nodes = vec![
        Node::Text("a".into()),
        region(
            RegionKind::Root {
                path: "root".into(),
            },
            vec![Node::Text("b".into())],
        ),
        Node::Text(" c".into()),
    ];
    assert!(
        canonical(&nodes, &Projection::default())
            == vec![Material::Text("a".into()), Material::Text("b c".into())]
    );
    let ignored = vec![region(
        RegionKind::Ignore {
            id: "first".into(),
            material_key: None,
        },
        vec![region(
            RegionKind::Ignore {
                id: "second".into(),
                material_key: Some("key".into()),
            },
            vec![],
        )],
    )];
    assert_eq!(
        super::ignore_contract(&ignored),
        [("first".into(), false), ("second".into(), true)]
    );
}

#[test]
fn fingerprints_distinguish_child_boundaries_node_kinds_and_empty_forests() {
    let element = |children| Material::Element("html".into(), "p".into(), vec![], children);
    let values = [
        vec![],
        vec![Material::Text("a".into())],
        vec![Material::Comment("a".into())],
        vec![Material::Doctype("a".into())],
        vec![Material::SlotBoundary("a".into())],
        vec![Material::Ignore("a".into(), None)],
        vec![Material::Ignore("a".into(), Some(String::new()))],
        vec![element(vec![Material::Text("a".into())])],
        vec![element(vec![]), Material::Text("a".into())],
        vec![Material::Slot("a".into(), vec![Material::Text("a".into())])],
        vec![
            Material::Slot("a".into(), vec![]),
            Material::Text("a".into()),
        ],
    ];
    for (i, left) in values.iter().enumerate() {
        for (j, right) in values.iter().enumerate() {
            assert_eq!(left == right, i == j);
            assert_eq!(
                fingerprint(left).unwrap() == fingerprint(right).unwrap(),
                i == j
            );
        }
    }
}
