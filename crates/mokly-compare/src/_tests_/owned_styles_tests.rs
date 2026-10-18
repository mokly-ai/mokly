//! Deep style collection respects trusted owners and ignore/template boundaries.

use std::collections::BTreeMap;
use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};

use super::collect;

fn style(css: &str) -> Node {
    let mut node = tree::element("style", &[], vec![Node::Text(css.into())]);
    if let Node::Element(element) = &mut node {
        element.style_owners = Some(vec!["old".into()]);
    }
    node
}

#[test]
fn deep_styles_map_owners_deduplicate_rules_and_skip_inert_subtrees() {
    thread::spawn(|| {
        let mut nodes = vec![style("a"), style("b"), style("a")];
        for _ in 0..20_000 {
            nodes = vec![tree::element("span", &[], nodes)];
        }
        nodes.extend([
            tree::element("template", &[], vec![style("inert")]),
            Node::Region {
                region: Region {
                    id: "ignore".into(),
                    kind: RegionKind::Ignore {
                        id: "ignore".into(),
                        material_key: None,
                    },
                },
                children: vec![style("ignored")],
            },
        ]);
        assert_eq!(
            collect(&nodes, &[("old".into(), "new".into())].into()),
            BTreeMap::from([("new".into(), "a\nb".into())])
        );
    })
    .join()
    .unwrap();
}
