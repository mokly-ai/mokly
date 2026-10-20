//! Selected external dependency roots keep logical requests and physical PostCSS inputs.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::cache::MemoryCache;
use mokly_graph::error::GraphError;
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::ThreadWorkers;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::{Call, ModuleResolution};
use unimock::Unimock;

use super::support::Consumer;

#[test]
fn external_css_modules_use_the_selected_root_without_entering_catalogue_sources() {
    let consumer = Consumer::new();
    let dependencies = tempfile::tempdir().unwrap();
    let package = dependencies.path().join("node_modules/fixture-theme");
    fs::create_dir_all(&package).unwrap();
    fs::write(
        package.join("package.json"),
        r#"{"name":"fixture-theme","version":"1.0.0"}"#,
    )
    .unwrap();
    fs::write(
        package.join("skin.module.css"),
        ".external { color: MOKLY_COLOR; background:url('./icon.svg'); }\n",
    )
    .unwrap();
    fs::write(package.join("icon.svg"), b"<svg>base asset</svg>").unwrap();
    let expected_source = serde_json::to_string(&package.join("skin.module.css")).unwrap();
    consumer.replace(
        "postcss.mjs",
        "Once(root, { result }) {",
        &format!("Once(root, {{ result }}) {{ if (root.nodes.some(node => node.selector === '.external') && result.opts.from !== {expected_source}) throw new Error('wrong physical PostCSS source');"),
    );
    consumer.replace(
        "library/chip.tsx",
        "import styles from",
        "import extra from 'fixture-theme/skin.module.css';\nimport styles from",
    );
    consumer.replace(
        "library/chip.tsx",
        "className={styles.chip}",
        "className={styles.chip + ' ' + extra.external}",
    );
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let base = Arc::new(BaseSide {
        sources: Lease {
            directory: consumer.root().into(),
            guard: Box::new(Unimock::new(())),
        },
        dependencies: Resolved {
            tier: Tier::Installed,
            node_modules: workspace.join("node_modules"),
            module_resolution: ModuleResolution {
                package_roots: vec![
                    workspace.to_string_lossy().into_owned(),
                    dependencies.path().to_string_lossy().into_owned(),
                ],
                ..Default::default()
            },
            warning: None,
            lease: Some(Lease {
                directory: dependencies.path().into(),
                guard: Box::new(Unimock::new(())),
            }),
            repository_roots: vec![consumer.root().into()],
        },
        identity: "dependency-base".into(),
    });
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        consumer.pool.clone(),
        Arc::new(MemoryCache::new(16 * 1024 * 1024)),
        Arc::new(ThreadWorkers::new(2).unwrap()),
        super::support::package_version::read(),
        Some(base),
    ));
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: runtime.clone(),
    };
    let prepared = builder.prepare(&consumer.config(), None).unwrap();
    let logical = "node_modules/.mokly-roots/1/fixture-theme/skin.module.css";
    assert!(
        prepared
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .modules
            .contains_key(logical)
    );
    let factory: &dyn GraphFactory = runtime.as_ref();
    let generation = factory
        .create(&consumer.config())
        .unwrap()
        .prepare(consumer.config(), prepared, None)
        .unwrap();
    assert!(
        !generation
            .catalogue()
            .model
            .sources
            .iter()
            .any(|path| path.contains("node_modules"))
    );
    let html = String::from_utf8(
        generation
            .render("components/chip/index.mobile.html")
            .unwrap()
            .bytes
            .clone(),
    )
    .unwrap();
    let asset = "assets/node_modules/.mokly-roots/1/fixture-theme/icon.svg";
    assert_eq!(
        generation.resource(asset).unwrap().unwrap(),
        b"<svg>base asset</svg>"
    );
    fs::write(package.join("icon.svg"), b"<svg>edited asset</svg>").unwrap();
    assert!(matches!(
        generation.resource(asset),
        Err(GraphError::InputsChanged { .. })
    ));
    let calls = consumer.pool.calls.lock().unwrap();
    let maps = calls
        .iter()
        .find_map(|call| match call {
            Call::CssModules(maps) => Some(maps),
            _ => None,
        })
        .unwrap();
    assert!(html.contains(&maps.class_maps[logical]["external"]));
    assert!(
        calls
            .iter()
            .any(|call| matches!(call, Call::ProcessCss(css) if css.source_path == logical))
    );
}

#[test]
fn head_assets_use_configured_package_roots_and_reject_changed_bytes() {
    let consumer = Consumer::single();
    let package = consumer.root().join("vendor/node_modules/fixture-theme");
    fs::create_dir_all(&package).unwrap();
    fs::write(consumer.root().join("vendor/package.json"), "{}").unwrap();
    fs::write(
        package.join("package.json"),
        r#"{"name":"fixture-theme","version":"1.0.0"}"#,
    )
    .unwrap();
    fs::write(
        package.join("skin.css"),
        ".chip { background: url('./icon.svg') }",
    )
    .unwrap();
    fs::write(package.join("icon.svg"), b"<svg>head asset</svg>").unwrap();
    consumer.replace(
        "mokly.config.json",
        "\"postcss\":",
        "\"moduleResolution\": {\"packageRoots\":[\"vendor\"]}, \"postcss\":",
    );
    consumer.replace(
        "library/chip.tsx",
        "import styles from",
        "import 'fixture-theme/skin.css';\nimport styles from",
    );
    let generation = consumer.generation(consumer.prepare().unwrap());
    let route = generation
        .resource_routes()
        .into_iter()
        .find(|route| route.starts_with("assets/") && route.ends_with("/fixture-theme/icon.svg"))
        .unwrap();
    assert_eq!(
        generation.resource(&route).unwrap().unwrap(),
        b"<svg>head asset</svg>"
    );
    assert!(
        !generation
            .contains_resource("vendor/node_modules/fixture-theme/icon.svg")
            .unwrap()
    );
    fs::write(package.join("icon.svg"), b"<svg>new content</svg>").unwrap();
    assert!(matches!(
        generation.resource(&route),
        Err(GraphError::InputsChanged { .. })
    ));
    let updated = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(
        updated.resource(&route).unwrap().unwrap(),
        b"<svg>new content</svg>"
    );
}
