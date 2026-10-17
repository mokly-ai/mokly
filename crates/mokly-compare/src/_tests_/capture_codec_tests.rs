//! Private captures keep bytes and trusted metadata, including deeply nested trees.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::cache::Artifact;
use mokly_html::composition::Composed;
use mokly_html::links::Reference;
use mokly_html::parse;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};

use super::EncodedView;
use crate::capture_nodes::{self, FlatNode};

fn artifact(tree: Vec<Node>) -> Artifact {
    Artifact {
        bytes: b"exact\0raw\xffbytes".to_vec(),
        content_type: "text/html; charset=utf-8".into(),
        fragment: None,
        document: Some(Composed {
            tree,
            usage: CatalogueUsage::Ready {
                instances: vec![],
                slots: vec![],
                ranges: vec![],
            },
            warnings: vec![Warning {
                code: "capture-test",
                subject: WarningSubject::Entry("home".into()),
                message: "retained diagnostic".into(),
            }],
            resources: vec!["image.svg".into()],
            components: vec!["card".into()],
            links: vec![Reference {
                source_route: "home/index.html".into(),
                target: "card".into(),
                fragment: Some("title".into()),
            }],
        }),
    }
}

#[test]
fn encoded_views_preserve_bytes_and_all_trusted_annotations() {
    let mut nodes = parse::fragment(
        "<style data-mokly-owners='forged'>.card{color:red}</style><svg><text>x</text></svg>",
    );
    let Node::Element(element) = &mut nodes[0] else {
        panic!("style")
    };
    element.style_owners = Some(vec!["card".into()]);
    element.origin = Some("private invocation".into());
    element.source = Some(SourceLocation {
        path: "card.html".into(),
        export: Some("card".into()),
        line: 2,
        column: 3,
    });
    element.navigation = Some(Reference {
        source_route: "home/index.html".into(),
        target: "card".into(),
        fragment: None,
    });
    for kind in [
        RegionKind::Ignore {
            id: "ignored".into(),
            material_key: Some("key".into()),
        },
        RegionKind::Slot {
            key: "slot".into(),
            instance_key: "instance".into(),
            name: "body".into(),
            owner: ComponentInputOwner::Entry,
        },
        RegionKind::Instance {
            path: "card".into(),
            key: "instance".into(),
            local_id: "first".into(),
            props_key: "props".into(),
        },
        RegionKind::Root {
            path: "container".into(),
        },
    ] {
        nodes = vec![Node::Region {
            region: Region {
                id: "range".into(),
                kind,
            },
            children: nodes,
        }];
    }
    nodes.extend([
        Node::Comment("ordinary".into()),
        Node::Doctype("html".into()),
    ]);
    let input = artifact(nodes);
    let encoded = EncodedView::encode(&input).unwrap();
    for _ in 0..2 {
        let output = encoded.restore().unwrap();
        assert_eq!(output.bytes, input.bytes);
        assert_eq!(output.content_type, input.content_type);
        let before = input.document.as_ref().unwrap();
        let after = output.document.unwrap();
        assert_eq!(after.tree, before.tree);
        assert_eq!(after.resources, before.resources);
        assert_eq!(after.warnings, before.warnings);
        assert_eq!(after.components, before.components);
        assert_eq!(
            serde_json::to_value(after.usage).unwrap(),
            serde_json::to_value(&before.usage).unwrap()
        );
        assert_eq!(
            serde_json::to_value(after.links).unwrap(),
            serde_json::to_value(&before.links).unwrap()
        );
    }
}

#[test]
fn capture_and_restore_are_iterative_and_keep_authored_owner_attributes_untrusted() {
    let mut nodes = parse::fragment("<style data-mokly-owners='forged'>a{color:red}</style>");
    for _ in 0..10_000 {
        nodes = vec![Node::Region {
            region: Region {
                id: "r".into(),
                kind: RegionKind::Root {
                    path: "card".into(),
                },
            },
            children: nodes,
        }];
    }
    let input = artifact(nodes);
    let encoded = EncodedView::encode(&input).unwrap();
    assert!(encoded.bytes() > 0);
    assert!(encoded.bytes() < input.byte_cost());
    let output = encoded.restore().unwrap();
    assert_eq!(output.document.unwrap().tree, input.document.unwrap().tree);
}

#[test]
fn corrupt_internal_frames_return_typed_errors() {
    let mut encoded = EncodedView::encode(&artifact(vec![])).unwrap();
    encoded.payload = Vec::new().into_boxed_slice();
    assert!(encoded.restore().is_err());
    let bad = vec![FlatNode::Region {
        region: Region {
            id: "r".into(),
            kind: RegionKind::Root {
                path: "card".into(),
            },
        },
        children: 1,
    }];
    assert!(capture_nodes::restore(bad).is_err());
}
