//! Published metadata stays inert, bounded, and inside even an implicit head.

use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::usage::{CatalogueUsage, ComponentRangeRecord, ComponentRangeTarget};

use crate::inspector::inject;

fn document(html: &str) -> Composed {
    Composed {
        tree: parse::document(html),
        usage: CatalogueUsage::Ready {
            instances: vec![],
            slots: vec![],
            ranges: vec![],
        },
        warnings: vec![],
        resources: vec![],
        components: vec![],
        links: vec![],
    }
}
#[test]
fn publication_uses_the_head_and_does_not_change_body_child_positions() {
    let html =
        String::from_utf8(inject(&document("<main><h1>Title</h1><p>Body</p></main>")).unwrap())
            .unwrap();
    assert!(html.find("data-mokly-inspector").unwrap() < html.find("</head>").unwrap());
    assert!(html.ends_with("<body><main><h1>Title</h1><p>Body</p></main></body></html>"));
    insta::assert_snapshot!(html);
}
#[test]
fn oversized_usage_is_explicit_and_never_truncated() {
    let mut document = document("<p>Body</p>");
    document.usage = CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: (0..4097)
            .map(|index| ComponentRangeRecord {
                id: format!("r-{index}"),
                target: ComponentRangeTarget::Root,
                parent_id: None,
            })
            .collect(),
    };
    let html = String::from_utf8(inject(&document).unwrap()).unwrap();
    assert!(html.contains("&quot;ranges&quot;:[]"));
    assert!(html.contains("&quot;error&quot;:&quot;limit&quot;"));
}
#[test]
fn reserved_authored_markers_and_invalid_parent_indices_fail() {
    for html in [
        "<template data-mokly-inspector>{}</template>",
        "<a data-mokly-inspector-link=0 href='#a'>link</a>",
    ] {
        assert!(inject(&document(html)).is_err());
    }
    let mut document = document("<p>Body</p>");
    document.usage = CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: vec![ComponentRangeRecord {
            id: "r-0".into(),
            target: ComponentRangeTarget::Root,
            parent_id: Some("r-0".into()),
        }],
    };
    assert!(inject(&document).is_err());
}

#[test]
fn a_link_outside_the_wire_bounds_has_an_explicit_error_map() {
    let mut document = document("<a href='x'>Link</a>");
    fn attach(nodes: &mut [mokly_html::tree::Node]) {
        for node in nodes {
            if let mokly_html::tree::Node::Element(element) = node {
                if element.name == "a" {
                    element.navigation = Some(mokly_html::links::Reference {
                        source_route: "a".into(),
                        target: "x".repeat(257),
                        fragment: None,
                    });
                    element.set("data-mokly-link", "x".repeat(257));
                }
                attach(&mut element.children);
            }
        }
    }
    attach(&mut document.tree);
    let html = String::from_utf8(inject(&document).unwrap()).unwrap();
    assert!(html.contains("&quot;error&quot;:&quot;limit&quot;"));
    assert!(!html.contains("data-mokly-inspector-link"));
}
