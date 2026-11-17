//! Optional source, ownership, and resource fields survive compact restoration.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::links::Reference;
use mokly_html::parse;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::ComponentInputOwner;

use crate::cache::Artifact;

use super::EncodedView;
use super::document_codec_tests::artifact;

#[test]
fn encoded_views_keep_absent_source_exports_and_optional_annotations() {
    let mut nodes = parse::html(DeliveredHtml::fragment("<a>link</a>"));
    let Node::Element(element) = &mut nodes[0] else {
        panic!("anchor")
    };
    element.source = Some(SourceLocation {
        path: "template.html".into(),
        export: None,
        line: 7,
        column: 11,
    });
    element.navigation = Some(Reference {
        source_route: "index.html".into(),
        target: "target".into(),
        fragment: Some("heading".into()),
    });
    let source_only = artifact(nodes.clone());
    let restored = EncodedView::encode(&source_only).unwrap().restore();
    assert!(
        restored.is_ok(),
        "absent source export must restore: {restored:?}"
    );
    assert_eq!(
        restored.unwrap().document.unwrap().tree,
        source_only.document.unwrap().tree
    );
    for kind in [
        RegionKind::Ignore {
            id: "ignore".into(),
            material_key: None,
        },
        RegionKind::Slot {
            key: "slot".into(),
            instance_key: "inner".into(),
            name: "body".into(),
            owner: ComponentInputOwner::Instance {
                instance_key: "outer".into(),
            },
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
    let input = artifact(nodes);
    let restored = EncodedView::encode(&input).unwrap().restore();
    assert!(
        restored.is_ok(),
        "optional annotations must restore: {restored:?}"
    );
    assert_eq!(
        restored.unwrap().document.unwrap().tree,
        input.document.unwrap().tree
    );
}

#[test]
fn encoded_resources_without_documents_restore_exact_bytes() {
    let input = Artifact {
        bytes: b"resource\0\xffbytes".to_vec(),
        content_type: "application/octet-stream".into(),
        document: None,
        fragment: None,
    };
    let output = EncodedView::encode(&input).unwrap().restore().unwrap();
    assert_eq!(output.bytes, input.bytes);
    assert_eq!(output.content_type, input.content_type);
    assert!(output.document.is_none());
    assert!(output.fragment.is_none());
}
