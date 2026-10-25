//! Grafted raw-text tags use the serialized parser namespace, not their source namespace.

use crate::tree::{Node, element, walk};
use crate::{parse, serialize};

const TAGS: [&str; 6] = ["script", "style", "xmp", "iframe", "noembed", "noframes"];
const TEXT: &str = "before <b>literal</b> & after";

#[test]
fn every_raw_text_tag_escapes_text_when_grafted_into_foreign_content() {
    let mut failures = Vec::new();
    for context in ["<svg></svg>", "<math></math>"] {
        for tag in TAGS {
            let mut nodes = parse::delivered_fragment(context);
            nodes[0]
                .children_mut()
                .unwrap()
                .push(element(tag, &[], vec![Node::Text(TEXT.into())]));
            let html = serialize::html(&nodes);
            let parsed = parse::delivered_document(&html);
            if !html.contains("&lt;b&gt;literal&lt;/b&gt;")
                || walk(&parsed)
                    .any(|node| matches!(node, Node::Element(element) if element.name == "b"))
            {
                failures.push((context, tag, html));
            }
        }
    }
    assert!(failures.is_empty(), "{failures:?}");
}

#[test]
fn html_integration_points_keep_the_existing_raw_text_contract() {
    for context in [
        "<svg><foreignObject></foreignObject></svg>",
        "<math><mtext></mtext></math>",
    ] {
        for tag in TAGS {
            let mut nodes = parse::delivered_fragment(context);
            nodes[0].children_mut().unwrap()[0]
                .children_mut()
                .unwrap()
                .push(element(tag, &[], vec![Node::Text(TEXT.into())]));
            let html = serialize::html(&nodes);
            assert!(html.contains(TEXT), "{tag}: {html}");
            let parsed = parse::delivered_document(&html);
            assert!(
                !walk(&parsed)
                    .any(|node| matches!(node, Node::Element(element) if element.name == "b")),
                "{tag}: {html}"
            );
        }
    }
}
