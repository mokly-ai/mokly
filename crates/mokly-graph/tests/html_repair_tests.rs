//! Rendered regions and browser output use the same repaired HTML5 tree.

use std::fs;

use mokly_catalogue::diagnostic::WarningSubject;
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::tree::{Node, RegionKind};
use mokly_html::{parse, serialize};
use mokly_model::material::instance_key;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use tempfile::TempDir;

mod support;

#[test]
fn reowned_instances_with_colliding_keys_lose_their_regions() {
    for (body, component) in [
        (
            "<ui-leaf></ui-leaf><p><ui-card></ui-card></p>",
            "<div><ui-leaf></ui-leaf></div>",
        ),
        (
            "<ui-leaf></ui-leaf><p><ui-card><ui-leaf></ui-leaf></ui-card></p>",
            "<div><slot></slot></div>",
        ),
        (
            "<p><ui-card></ui-card></p><ui-leaf></ui-leaf>",
            "<div><ui-leaf></ui-leaf></div>",
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
        fs::write(root.path().join("specs/card.component.html"), format!("---\ntitle: Card\nelement: ui-card\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\nslots: [children]\n---\n{component}")).unwrap();
        fs::write(root.path().join("specs/leaf.component.html"), "---\ntitle: Leaf\nelement: ui-leaf\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<b>Leaf</b>").unwrap();
        let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
        let artifact = generation.render("home/index.mobile.html").unwrap();
        let html = String::from_utf8_lossy(&artifact.bytes);
        assert_eq!(html.matches("<b>Leaf</b>").count(), 2);
        assert_eq!(html.matches("mokly-instance:start").count(), 1);
        let CatalogueUsage::Ready {
            instances,
            slots,
            ranges,
        } = &artifact.document.as_ref().unwrap().usage
        else {
            panic!()
        };
        assert_eq!(instances.len(), 1);
        assert_eq!(
            instances[0].key,
            instance_key(&ComponentInputOwner::Entry, None, "leaf").unwrap()
        );
        assert_eq!(instances[0].order, 0);
        assert!(slots.is_empty());
        assert_eq!(ranges.len(), 1);
        assert_eq!(generation.render_all().unwrap().warnings.len(), 1);
    }
}

#[test]
fn shared_body_repair_warnings_name_the_parent_once_across_variants() {
    for (suffix, metadata, subject) in [
        ("screen", "", WarningSubject::Entry("home".into())),
        (
            "component",
            "element: ui-home\npropSchema: {type: object, additionalProperties: false, properties: {}}\n",
            WarningSubject::Component("home".into()),
        ),
    ] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(
            root.path().join("mokly.config.json"),
            r#"{"colorSchemes":["light","dark"]}"#,
        )
        .unwrap();
        fs::write(root.path().join(format!("specs/home.{suffix}.html")), format!("---\ntitle: Home\n{metadata}variants: [{{slug: alt, title: Alternate, props: {{}}}}]\n---\n<p><ui-card></ui-card></p>")).unwrap();
        fs::write(root.path().join("specs/card.component.html"), "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div>Card</div>").unwrap();
        let generation = support::prepare(root.path(), 8 * 1024 * 1024, 2).0.unwrap();
        let report = generation.render_all().unwrap();
        assert_eq!(report.warnings.len(), 1);
        assert_eq!(report.warnings[0].subject, subject);
    }
}

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
        assert_eq!(
            serialize::html(&parse::html(DeliveredHtml::document(&html))),
            html
        );
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

#[test]
fn split_slots_and_ignore_regions_compare_as_enclosing_content() {
    for (parent, expected) in [("p", 0), ("section", 1)] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(root.path().join("specs/home.screen.html"), "---\ntitle: Home\n---\n<ui-card><mokly-ignore id=\"z\"><div>Dynamic</div></mokly-ignore></ui-card>").unwrap();
        fs::write(root.path().join("specs/card.component.html"), format!("---\ntitle: Card\nelement: ui-card\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\nslots: [children]\n---\n<{parent}><slot></slot></{parent}>")).unwrap();
        let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
        let artifact = generation.render("home/index.mobile.html").unwrap();
        let document = artifact.document.as_ref().unwrap();
        let mut pending: Vec<_> = document.tree.iter().collect();
        let (mut slots, mut ignores) = (0, 0);
        while let Some(node) = pending.pop() {
            match node {
                Node::Element(element) => pending.extend(&element.children),
                Node::Region { region, children } => {
                    slots += usize::from(matches!(region.kind, RegionKind::Slot { .. }));
                    ignores += usize::from(matches!(region.kind, RegionKind::Ignore { .. }));
                    pending.extend(children);
                }
                _ => {}
            }
        }
        assert_eq!((slots, ignores), (expected, expected));
        assert!(String::from_utf8_lossy(&artifact.bytes).contains("<div>Dynamic</div>"));
        let CatalogueUsage::Ready { slots, .. } = &document.usage else {
            panic!()
        };
        assert_eq!(slots.len(), 1);
        assert_eq!(
            generation.render_all().unwrap().warnings.len(),
            1 - expected
        );
    }
}
