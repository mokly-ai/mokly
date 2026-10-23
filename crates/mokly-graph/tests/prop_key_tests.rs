//! Prop destinations and component moves invalidate artifacts in a shared cache.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::types::RenderGeneration;
use mokly_model::usage::CatalogueUsage;
use tempfile::TempDir;

mod support;

fn write(root: &Path, path: &str, source: &str) {
    let file = root.join(path);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(file, source).unwrap();
}

fn prepare(root: &Path, cache: &Arc<dyn RenderCache>) -> Arc<dyn RenderGeneration> {
    support::prepare_with_cache(root, cache.clone(), 1, Default::default())
        .0
        .unwrap()
}

fn component(element: &str, body: &str) -> String {
    format!(
        "---\ntitle: Link\nelement: {element}\npropSchema: {{type: object, additionalProperties: false, properties: {{link: {{type: string}}}}}}\nprops: {{link: 'mock:tour'}}\n---\n{body}"
    )
}

fn tour(root: &Path, first: &str) {
    for path in ["b", "c"] {
        write(
            root,
            &format!("specs/{path}.screen.html"),
            &format!(
                "---\ntitle: Target\nuseCasePaths: [{}]\n---\n<p>Target</p>",
                if path == first { "tour" } else { "" }
            ),
        );
    }
    write(
        root,
        "specs/tour.use-case.yaml",
        &format!("title: Tour\nsteps: [{{screenPath: {first}}}]\n"),
    );
}

#[test]
fn prop_link_substitutions_and_pass_through_invalidate_cached_routes() {
    for (body, caller) in [
        (
            "<a href=\"{{link}}\">Go</a>",
            "<ui-go link=\"mock:tour\"></ui-go>",
        ),
        (
            "<div data-nav-href=\"{{link}}\">Go</div>",
            "<ui-go link=\"mock:tour\"></ui-go>",
        ),
        (
            "<button to=\"{{link}}\">Go</button>",
            "<ui-go link=\"tour\"></ui-go>",
        ),
        (
            "<a href=\"{{link}}\">Go</a>",
            "<ui-pass link=\"mock:tour\"></ui-pass>",
        ),
    ] {
        let root = TempDir::new().unwrap();
        write(root.path(), "mokly.config.json", "{}");
        tour(root.path(), "b");
        write(
            root.path(),
            "specs/a.screen.html",
            &format!("---\ntitle: A\n---\n{caller}"),
        );
        write(
            root.path(),
            "specs/go.component.html",
            &component("ui-go", body),
        );
        write(
            root.path(),
            "specs/pass.component.html",
            &component("ui-pass", "<ui-go link=\"$link\"></ui-go>"),
        );
        let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(8 * 1024 * 1024));
        let first = prepare(root.path(), &cache);
        let route = "a/index.mobile.html";
        let before = first.render(route).unwrap();
        assert!(String::from_utf8_lossy(&before.bytes).contains("../b/index.mobile.html"));
        tour(root.path(), "c");
        let second = prepare(root.path(), &cache);
        let after = second.render(route).unwrap();
        assert_ne!(before.bytes, after.bytes, "{body} / {caller}");
        assert_ne!(first.plans()[route].key, second.plans()[route].key);
        assert!(String::from_utf8_lossy(&after.bytes).contains("../c/index.mobile.html"));
        let fresh = support::prepare(root.path(), 0, 1).0.unwrap();
        assert_eq!(after.bytes, fresh.render(route).unwrap().bytes);
    }
}

#[test]
fn an_identical_component_moved_to_another_path_changes_markers_and_usage() {
    let root = TempDir::new().unwrap();
    write(root.path(), "mokly.config.json", "{}");
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<ui-card></ui-card>",
    );
    write(
        root.path(),
        "specs/card.component.html",
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div>Card</div>",
    );
    let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(8 * 1024 * 1024));
    let first = prepare(root.path(), &cache);
    let route = "a/index.mobile.html";
    let before = first.render(route).unwrap();
    fs::create_dir(root.path().join("specs/widgets")).unwrap();
    fs::rename(
        root.path().join("specs/card.component.html"),
        root.path().join("specs/widgets/card.component.html"),
    )
    .unwrap();
    let second = prepare(root.path(), &cache);
    let after = second.render(route).unwrap();
    assert_ne!(before.bytes, after.bytes);
    assert_ne!(first.plans()[route].key, second.plans()[route].key);
    assert!(String::from_utf8_lossy(&after.bytes).contains("path=\"widgets/card\""));
    let CatalogueUsage::Ready { instances, .. } = &after.document.as_ref().unwrap().usage else {
        panic!()
    };
    assert_eq!(instances.len(), 1);
    assert_eq!(instances[0].component_id, "widgets/card");
    let fresh = support::prepare(root.path(), 0, 1).0.unwrap();
    assert_eq!(after.bytes, fresh.render(route).unwrap().bytes);
}
