//! Deep owned trees use the ordinary thread stack for every owned-tree operation.

use std::slice;
use std::thread;

use mokly_html::serialize;
use mokly_html::tree::{Node, Region, RegionKind, element};

#[test]
fn deep_owned_tree_clones_formats_and_drops_on_a_default_thread() {
    thread::spawn(|| {
        let mut node = Node::Text("deep-leaf".into());
        for depth in 0..100_000 {
            node = if depth % 2 == 0 {
                element("span", &[], vec![node])
            } else {
                Node::Region {
                    region: Region {
                        id: depth.to_string(),
                        kind: RegionKind::Ignore {
                            id: format!("region-{depth}"),
                            material_key: None,
                        },
                    },
                    children: vec![node],
                }
            };
        }
        let mut copy = node.clone();
        assert!(node == copy);
        assert!(format!("{copy:?}").contains("deep-leaf"));
        let html = serialize::html(slice::from_ref(&node));
        assert_eq!(html.matches("<span>").count(), 50_000);
        assert!(html.contains("deep-leaf"));
        let mut leaf = &mut copy;
        loop {
            match leaf {
                Node::Element(element) => leaf = &mut element.children[0],
                Node::Region { children, .. } => leaf = &mut children[0],
                Node::Text(text) => {
                    *text = "changed-leaf".into();
                    break;
                }
                _ => panic!("expected deep text"),
            }
        }
        assert!(node != copy);
    })
    .join()
    .unwrap();
}
