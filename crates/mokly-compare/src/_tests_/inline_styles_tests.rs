//! Head collection keeps order, scope, and inert-subtree exclusions at depth.

use std::thread;

use mokly_html::tree::{self, Node, Region, RegionKind};

use super::collect;

fn style(css: &str) -> Node {
    tree::element("style", &[], vec![Node::Text(css.into())])
}

#[test]
fn deep_head_styles_preserve_order_and_do_not_leak_head_state_to_siblings() {
    thread::spawn(|| {
        let mut owned = style("owned");
        if let Node::Element(element) = &mut owned {
            element.style_owners = Some(vec!["card".into()]);
        }
        let mut nodes = vec![style("deep"), owned];
        for _ in 0..20_000 {
            nodes = vec![tree::element("span", &[], nodes)];
        }
        let mut head = vec![style("first")];
        head.extend(nodes);
        head.extend([
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
            style("last"),
        ]);
        let mut output = String::new();
        collect(
            &[tree::element("head", &[], head), style("outside")],
            false,
            &mut output,
        );
        assert_eq!(output, "first\ndeep\nlast\n");
    })
    .join()
    .unwrap();
}
