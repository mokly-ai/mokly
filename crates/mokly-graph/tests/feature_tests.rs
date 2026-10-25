//! Native composition keeps body link bases, forwarded slots, and shared Markdown assets.

use std::fs;
use std::path::Path;

use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use tempfile::TempDir;

mod support;

fn fixture(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().unwrap();
    fs::write(directory.path().join("mokly.config.json"), "{}").unwrap();
    for (name, text) in files {
        let path = directory.path().join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }
    directory
}

#[test]
fn component_links_use_their_definition_base_while_slots_keep_the_supplier_base() {
    let directory = fixture(&[
        (
            "specs/flow/home.screen.html",
            "---\ntitle: Home\n---\n<ui-link><a href=\"mock:./target\">Supplier target</a></ui-link>",
        ),
        (
            "specs/flow/target.screen.html",
            "---\ntitle: Flow target\n---\n<h1>Flow target</h1>",
        ),
        (
            "specs/components/link.component.html",
            "---\ntitle: Link\nelement: ui-link\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<div><a href=\"mock:./target\">Component target</a><slot></slot></div>",
        ),
        (
            "specs/components/target.page.html",
            "---\ntitle: Component target\n---\n<!doctype html><html><head><title>Target</title></head><body>Target</body></html>",
        ),
    ]);
    let (generation, _) = support::prepare(directory.path(), 2 * 1024 * 1024, 2);
    let generation = generation.unwrap();
    let html = String::from_utf8(
        generation
            .render("flow/home/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html.contains("data-mokly-link=\"components/target\""));
    assert!(html.contains("data-mokly-link=\"flow/target\""));
    assert!(html.contains("../../components/target/index.html"));
    generation.render_all().unwrap();
}

#[test]
fn directly_forwarded_slots_keep_the_original_owner_and_input_scope() {
    for forwarding in [
        "<ui-middle><slot></slot></ui-middle>",
        "<ui-middle>\n  <!-- formatting -->\n  <slot></slot>\n</ui-middle>",
    ] {
        let directory = fixture(&[
            (
                "specs/home.screen.html",
                "---\ntitle: Home\n---\n<ui-forward><ui-leaf label=\"Inside\"></ui-leaf></ui-forward>",
            ),
            (
                "specs/forward.component.html",
                &format!(
                    "---\ntitle: Forward\nelement: ui-forward\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\nslots: [children]\n---\n{forwarding}"
                ),
            ),
            (
                "specs/middle.component.html",
                "---\ntitle: Middle\nelement: ui-middle\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<aside><slot></slot></aside>",
            ),
            (
                "specs/leaf.component.html",
                "---\ntitle: Leaf\nelement: ui-leaf\npropSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}}}\nprops: {label: Saved}\n---\n<em>{{label}}</em>",
            ),
        ]);
        let (generation, _) = support::prepare(directory.path(), 2 * 1024 * 1024, 1);
        let document = generation
            .unwrap()
            .render("home/index.mobile.html")
            .unwrap();
        let CatalogueUsage::Ready {
            instances, slots, ..
        } = &document.document.as_ref().unwrap().usage
        else {
            panic!("usage not ready")
        };
        assert_eq!(instances.len(), 3);
        assert_eq!(slots.len(), 2);
        let forwarded = slots
            .iter()
            .find(|slot| slot.source_slot_key.is_some())
            .unwrap();
        let original = slots
            .iter()
            .find(|slot| Some(&slot.key) == forwarded.source_slot_key.as_ref())
            .unwrap();
        assert!(matches!(forwarded.owner, ComponentInputOwner::Entry));
        let leaf = instances
            .iter()
            .find(|instance| instance.component_id == "leaf")
            .unwrap();
        assert_eq!(leaf.slot_key.as_deref(), Some(original.key.as_str()));
        assert!(matches!(leaf.owner, ComponentInputOwner::Entry));
    }
}

#[test]
fn an_explicit_markdown_asset_can_also_have_a_delivered_css_copy() {
    let directory = fixture(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        (
            "specs/guide.md",
            "# Guide\n\n![Shared](./assets/shared.svg)\n",
        ),
        (
            "specs/assets/shared.svg",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
        ),
        (
            "css/base.css",
            ".x { background: url('../specs/assets/shared.svg') }",
        ),
    ]);
    fs::write(
        directory.path().join("mokly.config.json"),
        r#"{"stylesheets":[{"match":"**","stylesheets":["css/base.css"]}]}"#,
    )
    .unwrap();
    let (generation, _) = support::prepare(directory.path(), 2 * 1024 * 1024, 2);
    let generation = generation.unwrap();
    let summary = generation.render_all().unwrap();
    assert!(summary.closure.contains("specs/assets/shared.svg"));
    assert!(
        !generation
            .catalogue()
            .model
            .sources
            .contains(&"specs/assets/shared.svg".into())
    );
    assert!(
        generation
            .resource("assets/specs/assets/shared.svg")
            .unwrap()
            .is_some()
    );
}

#[test]
fn page_links_use_the_canonical_desktop_light_view() {
    let directory = fixture(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        (
            "specs/page.page.html",
            "---\ntitle: Page\n---\n<!doctype html><html><head><title>Page</title></head><body><a href=\"mock:home\">Home</a></body></html>",
        ),
    ]);
    let (generation, _) = support::prepare(directory.path(), 2 * 1024 * 1024, 1);
    let html = String::from_utf8(
        generation
            .unwrap()
            .render("page/index.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html.contains("../home/index.desktop.html"));
}

#[test]
fn substitutions_are_escaped_even_inside_raw_style_text() {
    let directory = fixture(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: '</style><script>bad</script>'}\n---\n<style>.x::after{content:\"{{label}}\"}</style><p>Visible</p>",
    )]);
    let (generation, _) = support::prepare(directory.path(), 2 * 1024 * 1024, 1);
    let html = String::from_utf8(
        generation
            .unwrap()
            .render("home/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html.contains("&lt;/style&gt;&lt;script&gt;bad&lt;/script&gt;"));
    assert!(!html.contains("<script>bad"));
}

#[test]
fn shared_css_keeps_each_delivery_roots_relative_asset_urls() {
    let directory = fixture(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        ("css/shared.css", ".x{background:url('../assets/a.png')}"),
        ("assets/a.png", "opaque"),
    ]);
    let inputs = mokly_graph::delivery_inputs::DeliveryInputs {
        stylesheet_roots: ["src/a.mockup.tsx", "src/deep/b.mockup.tsx"]
            .into_iter()
            .map(|path| mokly_css::types::StylesheetRoot {
                path: path.into(),
                stylesheets: vec!["css/shared.css".into()],
                excluded: Default::default(),
                local_css: false,
            })
            .collect(),
        ..Default::default()
    };
    let (generation, cache) =
        support::prepare_with_inputs(directory.path(), 2 * 1024 * 1024, 1, inputs);
    let generation = generation.unwrap();
    assert_eq!(cache.stats().entries, 2);
    assert_eq!(generation.resource_routes().len(), 3);
    assert_eq!(
        generation.resource("assets/assets/a.png").unwrap().unwrap(),
        b"opaque"
    );
    assert_eq!(cache.stats().entries, 2);
    for (route, expected) in [
        ("styles/src/a.mockup.tsx.css", "../../assets/assets/a.png"),
        (
            "styles/src/deep/b.mockup.tsx.css",
            "../../../assets/assets/a.png",
        ),
    ] {
        let bytes = generation.resource(route).unwrap().unwrap();
        let css = String::from_utf8(bytes).unwrap();
        let urls = mokly_css::syntax::references(&css);
        assert_eq!(urls[0].value, expected);
    }
}

#[test]
fn live_saved_props_reuse_a_warm_document_and_edits_keep_the_catalogue_cache() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/catalogue");
    let (generation, cache) = support::prepare(&root, 16 * 1024 * 1024, 2);
    let generation = generation.unwrap();
    let route = "home/index.mobile.html";
    let saved = generation.render(route).unwrap();
    let entry = generation
        .catalogue()
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let mokly_model::catalogue::EntryContent::Screen { visual, .. } = &entry.content else {
        panic!("screen fixture")
    };
    let before = cache.stats();
    let preview = generation.render_props(route, &visual.props).unwrap();
    assert_eq!(preview.artifact.bytes, saved.bytes);
    assert!(cache.stats().hits > before.hits);
    let mut edited = visual.props.clone();
    edited.insert(
        "label".into(),
        mokly_model::data::DataValue::String("Edited".into()),
    );
    let entries = cache.stats().entries;
    let preview = generation.render_props(route, &edited).unwrap();
    assert!(
        String::from_utf8(preview.artifact.bytes.clone())
            .unwrap()
            .contains("Edited")
    );
    assert_eq!(cache.stats().entries, entries);
    assert_eq!(generation.render(route).unwrap().bytes, saved.bytes);
}
