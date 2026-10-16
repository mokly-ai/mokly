//! Base preparation results select the extraction and retain its dependency leases.

use std::path::PathBuf;
use std::sync::Arc;

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::types::GraphFactory;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::{Call, ModuleResolution};
use unimock::Unimock;

use super::support::Consumer;

#[test]
fn base_renders_its_own_sources_and_holds_both_leases_until_the_graph_closes() {
    let head = Consumer::new();
    let base = Consumer::new();
    head.replace("specs/screen.mockup.tsx", "\"Hello\"", "\"HeadOnly\"");
    base.replace("specs/screen.mockup.tsx", "\"Hello\"", "\"BaseOnly\"");
    let head_generation = head.generation(head.prepare().unwrap());
    let head_document = head_generation.render("screen/index.mobile.html").unwrap();
    assert!(String::from_utf8_lossy(&head_document.bytes).contains("HeadOnly"));
    let dependencies = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let leased = Arc::new(BaseSide {
        sources: Lease {
            directory: base.root().into(),
            guard: Box::new(Unimock::new(())),
        },
        dependencies: Resolved {
            tier: Tier::Working,
            node_modules: dependencies.join("node_modules"),
            module_resolution: ModuleResolution {
                package_roots: vec![dependencies.to_string_lossy().into_owned()],
                ..Default::default()
            },
            warning: None,
            lease: Some(Lease {
                directory: dependencies.clone(),
                guard: Box::new(Unimock::new(())),
            }),
            repository_roots: vec![head.root().into(), dependencies],
        },
        identity: "base-commit".into(),
    });
    let weak = Arc::downgrade(&leased);
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        super::support::package_version::read(),
        Some(leased.clone()),
    ));
    assert!(Arc::ptr_eq(&runtime.pool, &head.runtime.pool));
    assert!(Arc::ptr_eq(&runtime.cache, &head.runtime.cache));
    assert!(Arc::ptr_eq(&runtime.workers, &head.runtime.workers));
    let prepared = {
        let builder: &dyn CatalogueBuilder = &Builder {
            tree: Arc::new(WorkingTree),
            discovery: Arc::new(Discoverer {
                tree: Arc::new(WorkingTree),
            }),
            definitions: runtime.clone(),
        };
        builder.prepare(&base.config(), None).unwrap()
    };
    let factory: &dyn GraphFactory = runtime.as_ref();
    let generation = factory
        .create(&base.config())
        .unwrap()
        .prepare(base.config(), prepared, None)
        .unwrap();
    let document = generation.render("screen/index.mobile.html").unwrap();
    let html = String::from_utf8(document.bytes.clone()).unwrap();
    assert!(html.contains("BaseOnly"));
    assert!(!html.contains("HeadOnly"));
    let calls = head.pool.calls.lock().unwrap();
    let Call::Bundle(bundle) = calls
        .iter()
        .find(|call| matches!(call, Call::Bundle(bundle) if bundle.source_root == base.root().to_string_lossy()))
        .unwrap()
    else {
        panic!("bundle")
    };
    assert_eq!(bundle.source_root, base.root().to_string_lossy());
    assert_eq!(bundle.repository_roots[0], head.root().to_string_lossy());
    assert!(
        calls
            .iter()
            .filter_map(|call| match call {
                Call::ProcessCss(css)
                    if css.context.starts_with("base-commit:")
                        || css.source_root == base.root().to_string_lossy() =>
                {
                    Some(css)
                }
                _ => None,
            })
            .all(|css| css.context.starts_with("base-commit:")
                && css.source_root == base.root().to_string_lossy())
    );
    assert!(calls.iter().any(
        |call| matches!(call, Call::ProcessCss(css) if css.context.starts_with("base-commit:"))
    ));
    assert_eq!(head.processes.hellos(), vec![1]);
    assert!(base.processes.hellos().is_empty());
    drop(calls);
    drop(runtime);
    drop(leased);
    assert!(weak.upgrade().is_some());
    drop(generation);
    assert!(weak.upgrade().is_none());
}
