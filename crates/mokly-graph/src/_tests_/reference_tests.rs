//! Iterative resource traversal preserves supplier identity and source encounter order.

use mokly_html::tree::{Node, Region, RegionKind, element};
use mokly_model::evidence::EvidenceOwner;
use mokly_model::usage::ComponentInputOwner;

use crate::references;

fn region(kind: RegionKind, children: Vec<Node>) -> Node {
    Node::Region {
        region: Region {
            id: "fixture".into(),
            kind,
        },
        children,
    }
}

fn instance(path: &str, key: &str, children: Vec<Node>) -> Node {
    region(
        RegionKind::Instance {
            path: path.into(),
            key: key.into(),
            local_id: path.into(),
            props_key: "props".into(),
        },
        children,
    )
}

fn slot(owner: ComponentInputOwner, children: Vec<Node>) -> Node {
    region(
        RegionKind::Slot {
            key: "slot".into(),
            name: "children".into(),
            instance_key: "inner-key".into(),
            owner,
        },
        children,
    )
}

fn image(url: &str) -> Node {
    element("img", &[("src", url)], vec![])
}

#[test]
fn nested_regions_and_srcdoc_keep_exact_instance_keys_and_reference_order() {
    let tree = vec![
        instance(
            "outer",
            "outer-key",
            vec![
                element(
                    "iframe",
                    &[
                        ("src", "first.svg"),
                        (
                            "srcdoc",
                            "<img src='inline.svg'><link rel='preload' href='hint.css'>",
                        ),
                        ("poster", "last.svg"),
                    ],
                    vec![],
                ),
                instance(
                    "inner",
                    "inner-key",
                    vec![
                        image("inner.svg"),
                        slot(
                            ComponentInputOwner::Instance {
                                instance_key: "outer-key".into(),
                            },
                            vec![image("supplied.svg")],
                        ),
                        slot(ComponentInputOwner::Entry, vec![image("entry.svg")]),
                        region(
                            RegionKind::Ignore {
                                id: "ignored".into(),
                                material_key: None,
                            },
                            vec![image("ignored.svg")],
                        ),
                        region(
                            RegionKind::Root { path: "own".into() },
                            vec![image("root.svg")],
                        ),
                        element(
                            "link",
                            &[("rel", "PREFETCH STYLESHEET"), ("href", "style.css")],
                            vec![],
                        ),
                    ],
                ),
                image("tail.svg"),
            ],
        ),
        image("outside.svg"),
    ];
    let found = references::collect(&tree);
    let actual: Vec<_> = found
        .iter()
        .map(|item| {
            let owner = match &item.owner {
                EvidenceOwner::Entry => "entry",
                EvidenceOwner::Component { path } => path,
            };
            (
                item.url.as_str(),
                owner,
                item.instance_key.as_deref(),
                item.ignored,
            )
        })
        .collect();
    assert_eq!(
        actual,
        [
            ("first.svg", "outer", Some("outer-key"), false),
            ("inline.svg", "outer", Some("outer-key"), false),
            ("hint.css", "outer", Some("outer-key"), true),
            ("last.svg", "outer", Some("outer-key"), false),
            ("inner.svg", "inner", Some("inner-key"), false),
            ("supplied.svg", "outer", Some("outer-key"), false),
            ("entry.svg", "entry", None, false),
            ("ignored.svg", "inner", Some("inner-key"), true),
            ("root.svg", "own", None, false),
            ("style.css", "inner", Some("inner-key"), false),
            ("tail.svg", "outer", Some("outer-key"), false),
            ("outside.svg", "entry", None, false),
        ]
    );
}
