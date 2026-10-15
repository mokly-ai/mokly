//! Rendered regions and browser output use the same repaired HTML5 tree.

use std::fs;

use mokly_html::{parse, serialize};
use mokly_model::material::instance_key;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use tempfile::TempDir;

mod support;

#[test]
fn surviving_nested_inputs_use_the_enclosing_owner_and_recomputed_identity() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p><ui-card></ui-card></p>",
    )
    .unwrap();
    fs::write(root.path().join("specs/card.component.html"), "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div><ui-leaf></ui-leaf></div>").unwrap();
    fs::write(root.path().join("specs/leaf.component.html"), "---\ntitle: Leaf\nelement: ui-leaf\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<b>Leaf</b>").unwrap();
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    let artifact = generation.render("home/index.mobile.html").unwrap();
    let CatalogueUsage::Ready {
        instances, ranges, ..
    } = &artifact.document.as_ref().unwrap().usage
    else {
        panic!()
    };
    assert_eq!(instances.len(), 1);
    assert_eq!(instances[0].component_id, "leaf");
    assert!(matches!(instances[0].owner, ComponentInputOwner::Entry));
    assert_eq!(
        instances[0].key,
        instance_key(&ComponentInputOwner::Entry, None, "leaf").unwrap()
    );
    assert_eq!(ranges.len(), 1);
    assert!(ranges[0].parent_id.is_none());
}

#[test]
fn block_and_anchor_components_that_escape_their_parent_lose_the_region() {
    for (body, component, parent, expected) in [
        (
            "<p>Intro <ui-card></ui-card> tail</p>",
            "<div class=\"card\">x</div>",
            "p",
            "<p>Intro </p><div class=\"card\">x</div> tail<p></p>",
        ),
        (
            "<a>outer <ui-card></ui-card></a>",
            "<a>inner</a>",
            "a",
            "<a>outer </a><a>inner</a>",
        ),
    ] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(
            root.path().join("specs/home.screen.html"),
            format!("---\ntitle: Home\n---\n{body}"),
        )
        .unwrap();
        fs::write(root.path().join("specs/card.component.html"), format!("---\ntitle: Card\nelement: ui-card\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{component}")).unwrap();
        let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
        let artifact = generation.render("home/index.mobile.html").unwrap();
        let html = String::from_utf8(artifact.bytes.clone()).unwrap();
        assert!(html.contains(expected), "{html}");
        assert!(!html.contains("mokly-instance:"));
        assert!(!html.contains("mokly-normalize"));
        assert_eq!(serialize::html(&parse::document(&html)), html);
        let document = artifact.document.as_ref().unwrap();
        let CatalogueUsage::Ready {
            instances,
            slots,
            ranges,
        } = &document.usage
        else {
            panic!()
        };
        assert!(instances.is_empty());
        assert!(slots.is_empty());
        assert!(ranges.is_empty());
        assert_eq!(document.warnings.len(), 1);
        assert_eq!(document.warnings[0].code, "html-foster-parented");
        assert_eq!(
            document.warnings[0].message,
            format!("component element ui-card is moved out of <{parent}> by HTML parsing")
        );
        assert_eq!(generation.render_all().unwrap().warnings.len(), 1);
    }
}

#[test]
fn authored_reserved_comments_are_removed_and_noscript_contains_real_markup() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(root.path().join("specs/home.screen.html"), "---\ntitle: Home\n---\n<!--mokly-instance:start id=\"r-0\"--><!-- mokly-todo: polish --><!-- ordinary --><noscript><p>Enable JS</p></noscript>").unwrap();
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    let html = String::from_utf8(
        generation
            .render("home/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(!html.contains("mokly-"));
    assert!(html.contains("<!-- ordinary -->"));
    assert!(html.contains("<noscript><p>Enable JS</p></noscript>"));
}

#[test]
fn github_alerts_render_as_plain_blockquotes() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/notes.md"),
        "> [!NOTE]\n> Remember this.\n",
    )
    .unwrap();
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    let html =
        String::from_utf8(generation.render("notes/index.html").unwrap().bytes.clone()).unwrap();
    assert!(html.contains("<blockquote>\n<p>[!NOTE]\nRemember this.</p>"));
    assert!(!html.contains("markdown-alert"));
    generation.render_all().unwrap();
}
