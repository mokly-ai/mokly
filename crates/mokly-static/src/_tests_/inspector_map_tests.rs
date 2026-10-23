//! Compact range maps and independently admissible navigation identities.

use mokly_html::links::Reference;
use mokly_html::tree::{self, Node, Region, RegionKind};
use mokly_model::usage::{CatalogueUsage, ComponentRangeRecord, ComponentRangeTarget};
use serde_json::Value;

use crate::inspector::inject;
use crate::inspector_tests::document;

fn link(path: &str, fragment: Option<&str>, target: &str) -> Node {
    let mut node = tree::element(
        "a",
        &[
            ("href", "fallback.html"),
            ("data-mokly-link", path),
            ("data-mokly-target", target),
        ],
        vec![Node::Text(path.into())],
    );
    if let Node::Element(element) = &mut node {
        element.navigation = Some(Reference {
            source_route: "home".into(),
            target: path.into(),
            fragment: fragment.map(str::to_owned),
        });
    }
    node
}
fn body(nodes: &mut [Node], children: Vec<Node>) {
    for node in nodes {
        if let Node::Element(element) = node {
            if element.name == "body" {
                element.children = children;
                return;
            }
            body(&mut element.children, children.clone());
        }
    }
}
fn map(html: &str) -> Value {
    let text = html
        .split("<template data-mokly-inspector=\"\">")
        .nth(1)
        .unwrap()
        .split("</template>")
        .next()
        .unwrap();
    serde_json::from_str(
        &text
            .replace("&quot;", "\"")
            .replace("&lt;", "<")
            .replace("&amp;", "&"),
    )
    .unwrap()
}

#[test]
fn ranges_parents_and_deduplicated_named_links_have_stable_indices() {
    let mut document = document("<body></body>");
    let key = "a".repeat(64);
    document.usage = CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: vec![
            ComponentRangeRecord {
                id: "r-0".into(),
                target: ComponentRangeTarget::Root,
                parent_id: None,
            },
            ComponentRangeRecord {
                id: "r-1".into(),
                target: ComponentRangeTarget::Instance {
                    instance_key: key.clone(),
                },
                parent_id: Some("r-0".into()),
            },
            ComponentRangeRecord {
                id: "r-2".into(),
                target: ComponentRangeTarget::Slot {
                    slot_key: "b".repeat(64),
                },
                parent_id: Some("r-1".into()),
            },
        ],
    };
    let links = vec![
        link("team", Some("members"), "named:target"),
        link("team", Some("members"), "named:target"),
        link("home", None, "_blank"),
        link("team", Some("1-intro"), "_self"),
        link("team", Some("équipe"), "_self"),
    ];
    body(
        &mut document.tree,
        vec![Node::Region {
            region: Region {
                id: "r-0".into(),
                kind: RegionKind::Root {
                    path: "card".into(),
                },
            },
            children: links,
        }],
    );
    let html = String::from_utf8(inject(&document, "home/index.html").unwrap()).unwrap();
    let metadata = map(&html);
    assert_eq!(metadata["ranges"][1], serde_json::json!([key, 0]));
    assert_eq!(metadata["ranges"][2], serde_json::json!([null, 1]));
    assert_eq!(metadata["links"].as_array().unwrap().len(), 2);
    assert_eq!(html.matches("data-mokly-inspector-link=\"0\"").count(), 2);
    assert_eq!(html.matches("data-mokly-inspector-link=\"1\"").count(), 1);
    assert!(metadata.get("error").is_none());
    insta::assert_snapshot!(serde_json::to_string_pretty(&metadata).unwrap());
}

#[test]
fn utf8_byte_and_link_count_limits_never_publish_a_truncated_map() {
    let mut document = document("<body></body>");
    document.usage = CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: (0..4096)
            .map(|index| ComponentRangeRecord {
                id: format!("r-{index}"),
                target: ComponentRangeTarget::Instance {
                    instance_key: "a".repeat(64),
                },
                parent_id: None,
            })
            .collect(),
    };
    let html = String::from_utf8(inject(&document, "home/index.html").unwrap()).unwrap();
    assert_eq!(
        map(&html),
        serde_json::json!({"ranges":[], "links":[], "error":"limit"})
    );
    document.usage = CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: vec![],
    };
    body(
        &mut document.tree,
        (0..1025)
            .map(|index| link(&format!("entry-{index}"), None, "_self"))
            .collect(),
    );
    let html = String::from_utf8(inject(&document, "home/index.html").unwrap()).unwrap();
    assert_eq!(
        map(&html),
        serde_json::json!({"ranges":[], "links":[], "error":"limit"})
    );
    assert!(!html.contains("data-mokly-inspector-link"));
}
