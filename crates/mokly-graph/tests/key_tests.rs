//! Document keys follow routing and component dependencies across shared-cache generations.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::types::RenderGeneration;
use tempfile::TempDir;

mod support;

fn write(root: &Path, path: &str, source: &str) {
    let file = root.join(path);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(file, source).unwrap();
}

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"colorSchemes":["light","dark"]}"#,
    );
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<a href=\"mock:b\">B</a>",
    );
    write(
        root.path(),
        "specs/b.screen.html",
        "---\ntitle: B\n---\n<h1>B</h1>",
    );
    root
}

fn prepare(root: &Path, cache: &Arc<dyn RenderCache>) -> Arc<dyn RenderGeneration> {
    support::prepare_with_cache(root, cache.clone(), 1, Default::default())
        .0
        .unwrap()
}

fn cache() -> Arc<dyn RenderCache> {
    Arc::new(MemoryCache::new(8 * 1024 * 1024))
}

#[test]
fn on_demand_renders_use_default_workers_with_no_cache_retention() {
    let root = fixture();
    write(
        root.path(),
        "specs/a.screen.html",
        &format!(
            "---\ntitle: Deep\n---\n{}Deep{}",
            "<div>".repeat(1000),
            "</div>".repeat(1000)
        ),
    );
    let (generation, cache) = support::prepare(root.path(), 0, 1);
    let generation = generation.unwrap();
    let first = generation.render("a/index.mobile.html").unwrap();
    let second = generation.render("a/index.mobile.html").unwrap();
    assert!(
        generation
            .closure("a/index.mobile.html")
            .unwrap()
            .files
            .is_empty()
    );
    assert_eq!(first.bytes, second.bytes);
    assert_eq!(cache.stats().entries, 0);
    assert!(
        String::from_utf8(first.bytes.clone())
            .unwrap()
            .contains("Deep")
    );
}

#[test]
fn a_component_pages_own_declared_css_is_a_document_input() {
    let root = fixture();
    write(
        root.path(),
        "specs/box.component.html",
        "---\ntitle: Box\nelement: ui-box\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div>Box</div>",
    );
    write(root.path(), "css/box.css", "div { color: red }");
    let cache = cache();
    let inputs = mokly_graph::delivery_inputs::DeliveryInputs {
        component_stylesheets: [("box".into(), vec!["css/box.css".into()])].into(),
        ..Default::default()
    };
    let first = support::prepare_with_cache(root.path(), cache.clone(), 1, inputs.clone())
        .0
        .unwrap();
    first.render("box/index.mobile.html").unwrap();
    write(root.path(), "css/box.css", "div { color: blue }");
    let second = support::prepare_with_cache(root.path(), cache, 1, inputs)
        .0
        .unwrap();
    assert_ne!(
        first.plans()["box/index.mobile.html"].key,
        second.plans()["box/index.mobile.html"].key
    );
}

fn changed(first: &dyn RenderGeneration, second: &dyn RenderGeneration, route: &str) {
    assert_ne!(first.plans()[route].key, second.plans()[route].key);
    assert_ne!(
        first.render(route).unwrap().bytes,
        second.render(route).unwrap().bytes
    );
}

#[test]
fn target_colour_scheme_changes_invalidate_cached_link_bytes() {
    let root = fixture();
    let cache = cache();
    let first = prepare(root.path(), &cache);
    first.render("a/index.mobile.dark.html").unwrap();
    write(
        root.path(),
        "specs/b.screen.html",
        "---\ntitle: B\ncolorSchemes: [light]\n---\n<h1>B</h1>",
    );
    let second = prepare(root.path(), &cache);
    changed(first.as_ref(), second.as_ref(), "a/index.mobile.dark.html");
    let html = String::from_utf8(
        second
            .render("a/index.mobile.dark.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    assert!(html.contains("../b/index.mobile.html"));
}

#[test]
fn target_kind_and_path_spelling_invalidate_cached_links() {
    let root = fixture();
    let cache = cache();
    let first = prepare(root.path(), &cache);
    first.render("a/index.mobile.html").unwrap();
    fs::remove_file(root.path().join("specs/b.screen.html")).unwrap();
    write(
        root.path(),
        "specs/b.page.html",
        "---\ntitle: B\n---\n<!doctype html><html><head><title>B</title></head><body>B</body></html>",
    );
    let second = prepare(root.path(), &cache);
    changed(first.as_ref(), second.as_ref(), "a/index.mobile.html");
    write(
        root.path(),
        "specs/b.page.html",
        "---\ntitle: B\npath: B\n---\n<!doctype html><html><head><title>B</title></head><body>B</body></html>",
    );
    let third = prepare(root.path(), &cache);
    changed(second.as_ref(), third.as_ref(), "a/index.mobile.html");
}

#[test]
fn use_case_first_step_and_its_scheme_are_link_inputs() {
    let root = fixture();
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<a href=\"mock:tour\">Tour</a>",
    );
    write(
        root.path(),
        "specs/c.screen.html",
        "---\ntitle: C\n---\n<h1>C</h1>",
    );
    write(
        root.path(),
        "specs/b.screen.html",
        "---\ntitle: B\nuseCasePaths: [tour]\n---\n<h1>B</h1>",
    );
    write(
        root.path(),
        "specs/tour.use-case.yaml",
        "title: Tour\nsteps: [{screenPath: b}]\n",
    );
    let cache = cache();
    let first = prepare(root.path(), &cache);
    first.render("a/index.mobile.dark.html").unwrap();
    write(
        root.path(),
        "specs/b.screen.html",
        "---\ntitle: B\n---\n<h1>B</h1>",
    );
    write(
        root.path(),
        "specs/c.screen.html",
        "---\ntitle: C\nuseCasePaths: [tour]\n---\n<h1>C</h1>",
    );
    write(
        root.path(),
        "specs/tour.use-case.yaml",
        "title: Tour\nsteps: [{screenPath: c}]\n",
    );
    let second = prepare(root.path(), &cache);
    changed(first.as_ref(), second.as_ref(), "a/index.mobile.dark.html");
    write(
        root.path(),
        "specs/c.screen.html",
        "---\ntitle: C\nuseCasePaths: [tour]\ncolorSchemes: [light]\n---\n<h1>C</h1>",
    );
    let third = prepare(root.path(), &cache);
    changed(second.as_ref(), third.as_ref(), "a/index.mobile.dark.html");
}

#[test]
fn components_reached_only_through_saved_slots_change_the_document_key() {
    let root = fixture();
    write(
        root.path(),
        "specs/box.component.html",
        "---\ntitle: Box\nelement: ui-box\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\nvariants:\n  - slug: filled\n    title: Filled\n    props: {}\n    slots: {children: '<ui-icon></ui-icon>'}\n---\n<section><slot></slot></section>",
    );
    write(
        root.path(),
        "specs/icon.component.html",
        "---\ntitle: Icon\nelement: ui-icon\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<i>v1</i>",
    );
    let cache = cache();
    let first = prepare(root.path(), &cache);
    first.render("box/filled/index.mobile.html").unwrap();
    write(
        root.path(),
        "specs/icon.component.html",
        "---\ntitle: Icon\nelement: ui-icon\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<i>v2</i>",
    );
    let second = prepare(root.path(), &cache);
    changed(
        first.as_ref(),
        second.as_ref(),
        "box/filled/index.mobile.html",
    );
}

#[test]
fn unrelated_routing_and_target_titles_do_not_invalidate_a_literal_link() {
    let root = fixture();
    let (first, cache) = support::prepare(root.path(), 8 * 1024 * 1024, 1);
    let first = first.unwrap();
    write(
        root.path(),
        "specs/b.screen.html",
        "---\ntitle: Other title\n---\n<h1>B</h1>",
    );
    write(
        root.path(),
        "specs/unrelated.page.html",
        "---\ntitle: Unrelated\n---\n<!doctype html><html><head><title>Other</title></head><body>Other</body></html>",
    );
    let second = prepare(root.path(), &cache);
    assert_eq!(
        first.plans()["a/index.mobile.html"].key,
        second.plans()["a/index.mobile.html"].key
    );
}

#[test]
fn planning_document_links_do_not_invalidate_document_keys() {
    let root = fixture();
    write(
        root.path(),
        "specs/library.md",
        "# Library\n\n[Plan](../plans/rust-rebuild.md)\n",
    );
    write(root.path(), "plans/rust-rebuild.md", "first\n");
    let cache = cache();
    let first = prepare(root.path(), &cache);
    let first_key = first.plans()["library/index.html"].key.clone();
    write(root.path(), "plans/rust-rebuild.md", "second\n");
    let second = prepare(root.path(), &cache);
    assert_eq!(first_key, second.plans()["library/index.html"].key);
}
