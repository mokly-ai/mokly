//! Deep style collection respects trusted owners and ignore/template boundaries.

use std::collections::BTreeMap;
use std::thread;

use mokly_css::attribution;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect as collect_css;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
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

#[test]
fn move_admission_keeps_a_declared_owner_match_inside_a_nested_region() {
    let regions = vec![
        Containment {
            path: "child".into(),
            root: false,
            instance: None,
        },
        Containment {
            path: "parent".into(),
            root: true,
            instance: None,
        },
    ]
    .into_iter()
    .collect();
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "hit".into())]),
            parent: None,
            children: vec![],
            text: true,
            regions,
            input_regions: Default::default(),
            owner: mokly_model::evidence::EvidenceOwner::Component {
                path: "parent".into(),
            },
        }],
    };
    let matching = match_document(
        &diff(
            &collect_css(b".hit{margin-left:1px}"),
            &collect_css(b".hit{margin-left:2px}"),
        ),
        Some(&tree),
        Some(&tree),
    );
    let changes = super::Changes {
        rules: attribution::observe_owned(
            "document",
            &matching,
            Some(&tree),
            Some(&tree),
            Some("parent"),
        ),
        ..Default::default()
    };
    assert!(changes.changes_owner(Some("parent")));
}
