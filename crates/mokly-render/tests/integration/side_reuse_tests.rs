//! Equal head and base inputs share render cache entries; a miss renders on its side.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::{Call, ModuleResolution};
use unimock::Unimock;

use super::render_key_tests::{consumer, dependency, render_calls};
use super::support::{Consumer, link_directory, package_version, workspace};

/// A base copy of the fixture. A base extraction holds no `node_modules`, because
/// Git does not track it, so the copy drops the consumer's installation link.
fn base() -> Consumer {
    let base = consumer();
    base.without_installation();
    base
}

/// A base runtime over `base`'s sources that reads its packages from `installation`,
/// sharing the head's pool, render cache, and workers, as Changes does. Every root
/// uses the loaded repository spelling, as the product's base preparation does.
fn base_runtime(head: &Consumer, base: &Consumer, installation: &Path) -> Arc<Runtime> {
    let head_root = head.repository();
    let root = installation.to_string_lossy().into_owned();
    let mut repository_roots = vec![head_root.clone()];
    if installation != head_root {
        repository_roots.push(installation.to_path_buf());
    }
    let side = Arc::new(BaseSide {
        sources: Arc::new(Lease {
            directory: base.repository(),
            guard: Box::new(Unimock::new(())),
        }),
        dependencies: Resolved {
            tier: if installation == head_root {
                Tier::Working
            } else {
                Tier::Installed
            },
            node_modules: installation.join("node_modules"),
            module_resolution: ModuleResolution {
                dependency_root: Some(root.clone()),
                package_roots: vec![root],
                ..ModuleResolution::default()
            },
            warning: None,
            lease: None,
            repository_roots,
        },
        identity: "base-commit".into(),
    });
    Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        package_version::read(),
        Some(side),
    ))
}

fn base_generation(runtime: &Arc<Runtime>, base: &Consumer) -> Arc<dyn RenderGeneration> {
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: runtime.clone(),
    };
    let prepared = builder.prepare(&base.config(), None).unwrap();
    let factory: &dyn GraphFactory = runtime.as_ref();
    factory
        .create(&base.config())
        .unwrap()
        .prepare(base.config(), prepared, None)
        .unwrap()
}

fn keys(generation: &dyn RenderGeneration) -> BTreeMap<String, String> {
    generation
        .plans()
        .iter()
        .map(|(route, plan)| (route.clone(), plan.key.0.clone()))
        .collect()
}

fn render_all(generation: &dyn RenderGeneration) {
    for route in generation.plans().keys() {
        generation.render(route).unwrap();
    }
}

fn generation_id(prepared: &dyn RenderGeneration) -> String {
    prepared
        .catalogue()
        .javascript
        .generation
        .as_ref()
        .unwrap()
        .id
        .clone()
}

#[test]
fn an_unchanged_base_reuses_head_renders_and_a_changed_entry_renders_on_its_side() {
    let head = consumer();
    let base = base();
    let head_generation = head.generation(head.prepare().unwrap());
    render_all(head_generation.as_ref());
    let runtime = base_runtime(&head, &base, &head.repository());
    let unchanged = base_generation(&runtime, &base);
    assert_eq!(keys(unchanged.as_ref()), keys(head_generation.as_ref()));
    assert_ne!(
        generation_id(unchanged.as_ref()),
        generation_id(head_generation.as_ref())
    );
    let calls = render_calls(&head).len();
    render_all(unchanged.as_ref());
    assert_eq!(render_calls(&head).split_off(calls), []);

    base.replace("specs/u/u.mockup.tsx", ">U</main>", ">U base</main>");
    let changed = base_generation(&runtime, &base);
    let moved: Vec<_> = keys(changed.as_ref())
        .into_iter()
        .filter(|(route, key)| keys(head_generation.as_ref())[route] != *key)
        .map(|(route, _)| route)
        .collect();
    assert_eq!(moved, ["u/u/index.desktop.html", "u/u/index.mobile.html"]);
    let before = head.pool.calls.lock().unwrap().len();
    let document = changed.render("u/u/index.mobile.html").unwrap();
    assert!(String::from_utf8_lossy(&document.bytes).contains("U base"));
    let renders: Vec<_> = head.pool.calls.lock().unwrap()[before..]
        .iter()
        .filter_map(|call| match call {
            Call::RenderScreen(render) => Some(render.generation.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(renders, [generation_id(changed.as_ref())]);
}

#[test]
fn a_base_with_its_own_installation_shares_no_javascript_render() {
    let head = consumer();
    let base = base();
    let installation = tempfile::tempdir().unwrap();
    link_directory(
        &workspace().join("node_modules"),
        &installation.path().join("node_modules"),
    );
    let installed = Consumer::fixture("render-keys");
    dependency(&installed, "1.0.0", "dep-1");
    std::fs::create_dir_all(installation.path().join("specs")).unwrap();
    std::fs::rename(
        installed.root().join("specs/node_modules"),
        installation.path().join("specs/node_modules"),
    )
    .unwrap();
    let head_generation = head.generation(head.prepare().unwrap());
    let runtime = base_runtime(
        &head,
        &base,
        &dunce::canonicalize(installation.path()).unwrap(),
    );
    let installed_base = base_generation(&runtime, &base);
    let (head_keys, base_keys) = (
        keys(head_generation.as_ref()),
        keys(installed_base.as_ref()),
    );
    let equal: Vec<_> = head_keys
        .iter()
        .filter(|(route, key)| base_keys.get(*route) == Some(*key))
        .map(|(route, _)| route.as_str())
        .collect();
    assert_eq!(
        equal,
        ["plain/index.desktop.html", "plain/index.mobile.html"]
    );
}
