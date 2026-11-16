//! Private captures keep bytes and trusted metadata, including deeply nested trees.

use std::collections::BTreeMap;
use std::io::Write;

use flate2::Compression;
use flate2::write::ZlibEncoder;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::Composed;
use mokly_html::fragment::StyleAttribution;
use mokly_html::links::Reference;
use mokly_html::parse;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::catalogue::SourceLocation;
use mokly_model::data::DataValue;
use mokly_model::usage::ComponentInstanceRecord;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use mokly_model::{wire_decode, wire_props};

use crate::cache::Artifact;
use crate::document_error::{CodecError, CodecInternalError};
use crate::document_nodes::{self, FlatNode};

use super::{EncodedView, Payload};

impl EncodedView {
    /// Damage an encoded document for cache restore-failure tests.
    pub(crate) fn invalidate_payload(&mut self) {
        self.payload = Box::new([]);
    }
}

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
    let mut nodes = parse::html(DeliveredHtml::fragment(
        "<style data-mokly-owners='forged'>.card{color:red}</style><svg><text>x</text></svg>",
    ));
    let Node::Element(element) = &mut nodes[0] else {
        panic!("style")
    };
    element.style_owners = Some(vec!["card".into()]);
    element.style_attribution = Some(vec![StyleAttribution {
        css: ".owned{color:red}".into(),
        owners: vec!["nested".into()],
    }]);
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
            after
                .links
                .iter()
                .map(|link| (&link.source_route, &link.target, &link.fragment))
                .collect::<Vec<_>>(),
            before
                .links
                .iter()
                .map(|link| (&link.source_route, &link.target, &link.fragment))
                .collect::<Vec<_>>()
        );
    }
}

#[test]
fn capture_and_restore_are_iterative_and_keep_authored_owner_attributes_untrusted() {
    let mut nodes = parse::html(DeliveredHtml::fragment(
        "<style data-mokly-owners='forged'>a{color:red}</style>",
    ));
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
fn capture_preserves_valid_props_at_the_64_level_limit() {
    for array in [false, true] {
        let mut value = DataValue::Null;
        for _ in 0..63 {
            value = if array {
                DataValue::Array(vec![value])
            } else {
                DataValue::Object(BTreeMap::from([("child".into(), value)]))
            };
        }
        let props = BTreeMap::from([("deep".into(), value)]);
        let wire = wire_props::encode(&props);
        assert_eq!(wire_decode::decode(&wire).unwrap(), props);
        let mut input = artifact(parse::html(DeliveredHtml::fragment("<p>deep props</p>")));
        input.document.as_mut().unwrap().usage = CatalogueUsage::Ready {
            instances: vec![ComponentInstanceRecord {
                key: "instance".into(),
                id: "local".into(),
                component_id: "card".into(),
                owner: ComponentInputOwner::Entry,
                slot_key: None,
                order: 0,
                props: wire,
                props_key: "props".into(),
                source: None,
            }],
            slots: vec![],
            ranges: vec![],
        };
        let encoded = EncodedView::encode(&input).unwrap();
        let output = encoded.restore().unwrap();
        assert_eq!(output.bytes, input.bytes);
        assert_eq!(
            output.document.unwrap().usage,
            input.document.unwrap().usage
        );
        assert!(encoded.retained_bytes() > encoded.bytes());
    }
}

#[test]
fn damaged_payloads_and_invalid_child_counts_return_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    let mut encoded = EncodedView::encode(&input).unwrap();
    encoded.invalidate_payload();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::Io { .. }))
    ));
    let mut tree = document_nodes::flatten(&input.document.as_ref().unwrap().tree);
    let FlatNode::Element { children, .. } = &mut tree[0] else {
        panic!("element")
    };
    *children = 2;
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&input.bytes).unwrap();
    serde_json::to_writer(&mut encoder, &Payload { tree }).unwrap();
    encoded.payload = encoder.finish().unwrap().into_boxed_slice();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::InvalidTree))
    ));
}
