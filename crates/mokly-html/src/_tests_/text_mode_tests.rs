//! HTML text modes retain their tree after serialization and another parse.

use crate::normalization::Repair;
use crate::normalization_annotate::annotate;
use crate::tree::{Node, Region, RegionKind, element};
use crate::{parse, serialize};

#[test]
fn text_content_models_and_ignored_initial_line_feeds_are_stable() {
    for tag in [
        "title",
        "textarea",
        "style",
        "script",
        "xmp",
        "iframe",
        "noembed",
        "noframes",
        "plaintext",
        "noscript",
        "pre",
        "listing",
    ] {
        for content in [
            "ordinary &amp; &#10; <b>text</b>",
            "\n\ninitial lines &lt;literal&gt;",
            "<!-- <script>text</script> -->",
        ] {
            for prefix in ["", "<p><b>", "<table>", "<template>"] {
                let source = format!(
                    "<!doctype html><html><head></head><body>{prefix}<{tag}>{content}</{tag}></body></html>"
                );
                let first = parse::document(&source);
                let bytes = serialize::html(&first);
                let second = parse::document(&bytes);
                assert_eq!(first, second, "{tag}: {content}");
                assert_eq!(
                    bytes,
                    serialize::html(&second),
                    "{tag}: second serialization"
                );
            }
        }
    }
}

#[test]
fn plaintext_after_active_formatting_is_stable() {
    for source in [
        "<p><b><plaintext>text & <i>literal</i>",
        "<b><plaintext>text",
        "<table><b><plaintext>text",
    ] {
        let first = parse::document(source);
        let bytes = serialize::html(&first);
        let second = parse::document(&bytes);
        assert_eq!(first, second, "{bytes}");
        assert_eq!(bytes, serialize::html(&second));
        let fragment = parse::fragment(source);
        assert_eq!(fragment, parse::fragment(&serialize::html(&fragment)));
    }
}

#[test]
fn plaintext_formatting_clones_keep_authored_characters_and_entity_spellings() {
    let payload = "text & <i>literal</i> \"quotes\" &amp; &#60;";
    for prefix in ["<p><b>", "<b>", "<table><b>"] {
        let source = format!("<p>Before &amp;</p>{prefix}<plaintext>{payload}");
        for nodes in [parse::document(&source), parse::fragment(&source)] {
            let bytes = serialize::html(&nodes);
            assert!(bytes.contains(payload), "{bytes}");
            assert!(bytes.contains("Before &amp;"), "{bytes}");
            let repaired = parse::document(&bytes);
            assert_eq!(repaired, parse::document(&serialize::html(&repaired)));
            assert!(serialize::html(&repaired).contains(payload));
        }
    }
}

#[test]
fn plaintext_serialization_does_not_expose_private_repair_markers() {
    let nodes = vec![Node::Region {
        region: Region {
            id: "r-1".into(),
            kind: RegionKind::Root {
                path: "panel".into(),
            },
        },
        children: vec![
            element("plaintext", &[], vec![Node::Text("literal <b>&".into())]),
            element("p", &[], vec![Node::Text("sibling".into())]),
        ],
    }];
    let marked = annotate(nodes, &mut Repair::default());
    let bytes = serialize::html(&marked);
    let payload = bytes.split("literal").nth(1).unwrap();
    assert_eq!(payload, " <b>&<p>sibling</p>");
    assert!(!payload.contains("mokly-normalize"));
    let parsed = parse::document(&bytes);
    assert_eq!(parsed, parse::document(&serialize::html(&parsed)));
}
