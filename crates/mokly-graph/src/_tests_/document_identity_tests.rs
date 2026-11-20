//! Compound identities cover exact bytes, private annotations, and complete retained metadata.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::parse;
use mokly_html::tree::Node;
use mokly_model::usage::CatalogueUsage;

use crate::cache::Artifact;

use super::EncodedView;
use super::document_codec_tests::artifact;

#[test]
fn compound_identities_cover_each_retained_metadata_group_and_private_tree_annotations() {
    let before = artifact(parse::html(DeliveredHtml::fragment("<p>Same</p>")));
    let (_, identity) = EncodedView::encode_identified(&before).unwrap();
    assert_eq!(EncodedView::comparison_identity(&before).unwrap(), identity);
    for field in [
        "style owners",
        "bytes",
        "content type",
        "usage",
        "resources",
        "components",
        "links",
        "warnings",
    ] {
        let mut after = before.clone();
        if field == "bytes" {
            after.bytes.push(0);
        } else if field == "content type" {
            after.content_type.push_str("; charset=utf-8");
        } else {
            let document = after.document.as_mut().unwrap();
            match field {
                "usage" => document.usage = CatalogueUsage::Unavailable,
                "resources" => document.resources.push("second.svg".into()),
                "components" => document.components.push("second".into()),
                "links" => document.links[0].fragment = None,
                "warnings" => document.warnings[0].message.push_str(" changed"),
                "style owners" => {
                    let Node::Element(element) = &mut document.tree[0] else {
                        panic!("paragraph")
                    };
                    element.style_owners = Some(vec!["trusted".into()]);
                }
                _ => unreachable!(),
            }
        }
        assert_ne!(
            EncodedView::comparison_identity(&after).unwrap(),
            identity,
            "changed {field}"
        );
    }
}

#[test]
fn byte_and_tree_section_boundaries_prevent_equal_concatenations_from_aliasing() {
    let mut before: Artifact = artifact(vec![Node::Text(String::new())]);
    before.bytes.clear();
    let mut after = before.clone();
    after.bytes = vec![1, 2];
    after.document.as_mut().unwrap().tree.clear();
    assert_ne!(
        EncodedView::comparison_identity(&before).unwrap(),
        EncodedView::comparison_identity(&after).unwrap()
    );
}
