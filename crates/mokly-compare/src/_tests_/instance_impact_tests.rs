//! Slot scopes preserve first sibling placement and later subtree replacement.

use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::usage::ComponentInputOwner;

use crate::material::{Material, Projection};

use super::slots;

fn slot(text: &str) -> Node {
    Node::Region {
        region: Region {
            id: text.into(),
            kind: RegionKind::Slot {
                key: text.into(),
                instance_key: "instance".into(),
                name: "children".into(),
                owner: ComponentInputOwner::Entry,
            },
        },
        children: vec![Node::Text(text.into())],
    }
}

#[test]
fn deep_slot_search_preserves_scope_merge_order() {
    thread::spawn(|| {
        let mut nested = vec![slot("nested-first"), slot("nested-second")];
        for _ in 0..20_000 {
            nested = vec![tree::element("span", &[], nested)];
        }
        let mut nodes = vec![slot("first")];
        nodes.extend(nested);
        nodes.push(slot("last"));
        let found = slots(&nodes, "instance", &Projection::default());
        assert!(found["children"] == vec![Material::Text("nested-first".into())]);
    })
    .join()
    .unwrap();
}
