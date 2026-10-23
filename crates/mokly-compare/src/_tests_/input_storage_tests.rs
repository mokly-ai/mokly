//! Supplier ancestry shares one immutable path per instance instead of copying prefixes.

use std::collections::{BTreeMap, BTreeSet};

use mokly_html::tree::{self, Node, Region, RegionKind};

use crate::matching_tree::document;

fn storage(depth: usize) -> usize {
    let mut nodes = vec![tree::element("span", &[], vec![])];
    for index in 0..depth {
        nodes = vec![Node::Region {
            region: Region {
                id: format!("r-{index}"),
                kind: RegionKind::Instance {
                    key: format!("key-{index}"),
                    path: format!("component-{index}"),
                    local_id: "id".into(),
                    props_key: "props".into(),
                },
            },
            children: vec![tree::element("section", &[], nodes)],
        }];
    }
    let tree = document(&nodes, &BTreeMap::new());
    assert!(tree.valid());
    let mut regions = BTreeSet::new();
    for (index, element) in tree.elements.iter().enumerate() {
        assert_eq!(element.input_regions.len(), (index + 1).min(depth));
        for region in element.input_regions.iter() {
            regions.insert(region as *const _ as usize);
        }
    }
    regions.len()
}

#[test]
fn input_containment_storage_grows_with_instances_not_depth_times_elements() {
    let small = storage(128);
    let large = storage(512);
    assert!(small > 0);
    assert!(
        large * 2 <= small * 9,
        "input containment allocations: {small} -> {large}"
    );
    assert_eq!((small, large), (128, 512));
}
