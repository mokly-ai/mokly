//! Linked workspace CSS keeps repository attribution through selected dependency roots.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::cache::MemoryCache;
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::ThreadWorkers;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;
use unimock::Unimock;

use super::support::{Consumer, package_version, workspace};

#[test]
fn linked_workspace_stylesheets_keep_both_repository_aliases_in_sources() {
    let consumer = Consumer::new();
    let installation = tempfile::tempdir().unwrap();
    let package = consumer.root().join("workspace-packages/theme");
    fs::create_dir_all(&package).unwrap();
    fs::create_dir(installation.path().join("node_modules")).unwrap();
    fs::write(
        package.join("package.json"),
        r#"{"name":"linked-theme","version":"1.0.0"}"#,
    )
    .unwrap();
    fs::write(package.join("style.css"), ".linked {color:blue}").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        &package,
        installation.path().join("node_modules/linked-theme"),
    )
    .unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(
        &package,
        installation.path().join("node_modules/linked-theme"),
    )
    .unwrap();
    consumer.replace(
        "library/chip.module.css",
        ".chip",
        "@import 'linked-theme/style.css';\n.chip",
    );
    let workspace = workspace();
    let base = Arc::new(BaseSide {
        sources: Arc::new(Lease {
            directory: consumer.root().into(),
            guard: Box::new(Unimock::new(())),
        }),
        dependencies: Resolved {
            tier: Tier::Working,
            node_modules: installation.path().join("node_modules"),
            module_resolution: ModuleResolution {
                package_roots: vec![
                    installation.path().to_string_lossy().into_owned(),
                    workspace.to_string_lossy().into_owned(),
                ],
                ..Default::default()
            },
            repository_roots: vec![consumer.config().repo_root],
            warning: None,
            lease: None,
        },
        identity: "linked-base".into(),
    });
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        consumer.pool.clone(),
        Arc::new(MemoryCache::new(1024 * 1024)),
        Arc::new(ThreadWorkers::new(1).unwrap()),
        package_version::read(),
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
    let factory: &dyn GraphFactory = runtime.as_ref();
    let generation = factory
        .create(&consumer.config())
        .unwrap()
        .prepare(consumer.config(), prepared, None)
        .unwrap();
    for path in [
        "node_modules/linked-theme/style.css",
        "workspace-packages/theme/style.css",
    ] {
        assert!(
            generation
                .catalogue()
                .model
                .sources
                .iter()
                .any(|source| source == path),
            "{path}"
        );
    }
    let css = generation
        .resource("styles/specs/components/chip.mockup.tsx.css")
        .unwrap()
        .unwrap();
    assert!(String::from_utf8(css).unwrap().contains(".linked"));
}
