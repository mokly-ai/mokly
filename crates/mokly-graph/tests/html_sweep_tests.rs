//! Native HTML fixtures preserve rendering behavior from the former backend.

use std::fs;
use std::path::Path;

use mokly_html::tree::{Node, RegionKind};
use mokly_model::catalogue::EntryContent;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner, ComponentRangeTarget};
use mokly_model::wire_decode;
use serde_json::json;
use tempfile::TempDir;

mod support;

fn root() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/html-sweep")
}

#[test]
fn html_fixture_renders_all_variants_axes_assets_and_front_matter() {
    let (generation, _) = support::prepare(&root(), 8 * 1024 * 1024, 2);
    let generation = generation.unwrap();
    let summary = generation.render_all().unwrap();
    assert_eq!(summary.documents, 31);
    assert!(summary.warnings.is_empty(), "{:?}", summary.warnings);
    let views: Vec<_> = generation.plans().keys().map(|route| {
        let artifact = generation.render(route).unwrap();
        json!({"route":route,"digest":mokly_model::material::digest(&artifact.bytes),"usage":artifact.document.as_ref().unwrap().usage})
    }).collect();
    println!(
        "HTML_SWEEP {}",
        json!({
            "fixture":"html-sweep","entries":generation.catalogue().model.entries.iter().map(|entry| json!({"path":entry.metadata.path,"kind":entry.content.kind(),"variantOf":entry.metadata.variant_of})).collect::<Vec<_>>(),
            "views":views,"resources":generation.resource_routes(),"closure":summary.closure,"warnings":summary.warnings.len()
        })
    );
    assert_eq!(
        summary.closure.into_iter().collect::<Vec<_>>(),
        ["media/icon.svg"]
    );
    assert_eq!(
        generation
            .resource("assets/media/background.svg")
            .unwrap()
            .unwrap(),
        fs::read(root().join("media/background.svg")).unwrap()
    );
    let home = generation
        .catalogue()
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    assert_eq!(home.metadata.description, "no");
    assert_eq!(home.metadata.tags, ["html", "sweep"]);
    assert_eq!(
        home.metadata.rationale.as_deref(),
        Some("A native rendering fixture.")
    );
    let EntryContent::Screen {
        address,
        use_case_paths,
        ..
    } = &home.content
    else {
        panic!("screen")
    };
    assert_eq!(address.as_deref(), Some("/account"));
    assert_eq!(use_case_paths, &["tour"]);
    for (route, visible, viewport) in [
        ("home/index.mobile.html", true, "Mobile only"),
        ("home/index.desktop.dark.html", true, "Desktop only"),
        ("home/off/index.mobile.dark.html", false, "Mobile only"),
    ] {
        let html = String::from_utf8(generation.render(route).unwrap().bytes.clone()).unwrap();
        assert_eq!(html.contains("Visible content"), visible);
        assert!(html.contains(viewport));
        assert!(!html.contains(if viewport == "Mobile only" {
            "Desktop only"
        } else {
            "Mobile only"
        }));
        assert!(!html.contains("mokly-viewport=") && !html.contains("mokly-if="));
        assert!(!html.contains("mokly-forged"));
        assert!(html.contains("<!-- ordinary comment -->"));
        assert!(html.contains("{{ never-closes"));
        assert!(html.contains("title=\"$literal\""));
        assert!(html.contains("$$literal"));
        if visible {
            assert!(html.contains("&lt;Ada &amp;"));
            assert!(html.contains("&quot;Co&quot;"));
            assert!(html.contains("parent-only"));
        } else {
            assert!(html.contains("<h1>Variant</h1>"));
            assert!(!html.contains("parent-only"));
            assert!(html.contains("<input disabled=\"\""));
        }
    }
}

#[test]
fn html_slots_and_empty_or_multiple_roots_keep_their_logical_inputs() {
    let generation = support::prepare(&root(), 8 * 1024 * 1024, 1).0.unwrap();
    let artifact = generation.render("home/index.mobile.html").unwrap();
    let html = String::from_utf8(artifact.bytes.clone()).unwrap();
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &artifact.document.as_ref().unwrap().usage
    else {
        panic!("ready usage")
    };
    let panel = instances.iter().find(|item| item.id == "panel").unwrap();
    assert_eq!(
        serde_json::to_value(wire_decode::decode(&panel.props).unwrap()).unwrap(),
        json!({"active":true,"amount":2.5,"count":3,"label":"Receiver","meta":{"note":"parent-only","tag":"paid"}})
    );
    let cash = instances.iter().find(|item| item.id == "cash").unwrap();
    assert!(matches!(cash.owner, ComponentInputOwner::Entry));
    assert!(cash.slot_key.is_some());
    assert_eq!(ranges.iter().filter(|range| matches!(&range.target, ComponentRangeTarget::Instance { instance_key } if instance_key == &cash.key)).count(), 2);
    assert!(slots.iter().any(|slot| slot.name == "heading"));
    assert_eq!(html.matches("$cash").count(), 2);
    assert!(html.contains("<h2>Receiver</h2>"));
    assert_eq!(html.matches("Supplier &lt;Ada").count(), 2);
    assert!(instances.iter().any(|item| item.id == "empty"));
    assert!(html.contains("Prefix<strong>"));
    assert!(html.contains("</strong>Suffix"));
    assert!(!html.contains("<ui-") && !html.contains("<slot"));
}

#[test]
fn ignore_regions_keep_placeholder_scope_and_stay_out_of_serialized_bytes() {
    let generation = support::prepare(&root(), 0, 1).0.unwrap();
    let first = generation.render("home/index.mobile.html").unwrap();
    let second = generation.render("home/index.mobile.html").unwrap();
    assert_eq!(first.bytes, second.bytes);
    let mut ignored = Vec::new();
    let mut pending: Vec<_> = first.document.as_ref().unwrap().tree.iter().collect();
    while let Some(node) = pending.pop() {
        match node {
            Node::Element(element) => pending.extend(&element.children),
            Node::Region { region, children } => {
                if let RegionKind::Ignore { id, material_key } = &region.kind {
                    ignored.push((id.clone(), material_key.clone()));
                }
                pending.extend(children);
            }
            _ => {}
        }
    }
    ignored.sort();
    assert_eq!(
        ignored,
        [
            ("active".into(), Some("version-one".into())),
            ("panel-clock".into(), None),
            ("slot-clock".into(), None)
        ]
    );
    let html = String::from_utf8(first.bytes.clone()).unwrap();
    assert!(!html.contains("mokly-ignore"));
    assert!(html.contains("Receiver clock") && html.contains("Material text"));
}

#[test]
fn html_own_pages_saved_slots_and_logical_links_use_effective_views() {
    let generation = support::prepare(&root(), 8 * 1024 * 1024, 2).0.unwrap();
    let own = String::from_utf8(
        generation
            .render("parts/panel/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(own.contains("Saved panel") && own.contains("Default body"));
    assert!(own.contains("Default heading") && own.contains("Second default"));
    let variant = String::from_utf8(
        generation
            .render("parts/panel/alternate/index.desktop.dark.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert_eq!(
        variant.matches("Variant heading Alternate panel").count(),
        2
    );
    assert!(variant.contains("title=\"present\"") && variant.contains("data-active=\"\""));
    let dark = String::from_utf8(
        generation
            .render("home/index.mobile.dark.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(dark.contains("../target/index.mobile.html#summary"));
    assert!(!dark.contains("target/index.mobile.dark.html"));
    assert!(dark.contains("data-nav-href=\"../target/index.mobile.html#summary\""));
    let page =
        String::from_utf8(generation.render("page/index.html").unwrap().bytes.clone()).unwrap();
    assert!(page.contains("../home/index.desktop.html#home"));
    assert!(!page.contains("theme.css"));
}

#[test]
fn bom_and_crlf_html_front_matter_reaches_the_same_template_renderer() {
    let directory = TempDir::new().unwrap();
    fs::create_dir(directory.path().join("specs")).unwrap();
    fs::write(directory.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(directory.path().join("specs/front.screen.html"), "\u{feff}---\r\ntitle: Front\r\nprops: {name: no}\r\n---\r\n<p title=\"{{\tname }}\">{{ name\r\n }}</p>").unwrap();
    let generation = support::prepare(directory.path(), 1024 * 1024, 1)
        .0
        .unwrap();
    let html = String::from_utf8(
        generation
            .render("front/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html.contains("<p title=\"no\">no</p>"), "{html}");
}
