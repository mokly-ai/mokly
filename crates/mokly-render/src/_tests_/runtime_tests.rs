//! Runtime sides get unique PostCSS contexts and normalized package roots.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::{Config, ModuleResolution, ResolvedConfig};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;
use crate::side::BaseSide;

fn runtime() -> Runtime {
    let mut runtime = runtime_with_base(None);
    runtime.dependency_tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
    ));
    runtime
}

fn runtime_with_base(base: Option<Arc<BaseSide>>) -> Runtime {
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "version".into(),
        base,
    )
}

fn base_side() -> Arc<BaseSide> {
    Arc::new(BaseSide {
        working_root: "/repo".into(),
        sources: Arc::new(Lease {
            directory: "/cache/base".into(),
            guard: Box::new(Unimock::new(())),
        }),
        dependencies: Resolved {
            tier: Tier::Working,
            node_modules: "/repo/node_modules".into(),
            module_resolution: Default::default(),
            warning: None,
            lease: None,
            repository_roots: vec!["/repo".into()],
        },
        cache_namespace: None,
        identity: "base".into(),
    })
}

#[test]
fn contexts_are_unique_across_runtime_instances_and_clones() {
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let one = runtime();
    let two = runtime();
    let contexts = [
        one.side(&config).context,
        one.clone().side(&config).context,
        two.side(&config).context,
    ];
    assert_eq!(contexts.into_iter().collect::<BTreeSet<_>>().len(), 3);
}

#[test]
fn package_roots_reach_the_sidecar_in_normalized_form() {
    let config = ResolvedConfig {
        input: Config {
            module_resolution: Some(ModuleResolution {
                package_roots: Some(vec!["../packages/ui".into(), "..".into()]),
                ..Default::default()
            }),
            ..Default::default()
        },
        file: "/repo/tools/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    assert_eq!(
        runtime()
            .side(&config)
            .module_resolution
            .package_roots
            .iter()
            .map(PathBuf::from)
            .collect::<Vec<_>>(),
        // The configured `..` repeats an ancestor, and the head keeps one copy as the
        // base does.
        ["/repo/tools", "/repo", "/repo/packages/ui"].map(PathBuf::from)
    );
}

#[test]
fn a_base_of_a_base_keeps_only_the_original_weak_head_source() {
    let head = Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "version".into(),
        None,
    );
    let first = head.for_base(Arc::new(Unimock::new(())), "version".into(), None);
    let second = first.for_base(Arc::new(Unimock::new(())), "version".into(), None);
    assert!(!first.watch_resolution);
    assert!(!second.watch_resolution);
    assert!(Arc::ptr_eq(
        &second.head_styles.as_ref().unwrap().upgrade().unwrap(),
        &head.styles
    ));
    assert!(!Arc::ptr_eq(
        &second.head_styles.as_ref().unwrap().upgrade().unwrap(),
        &first.styles
    ));
    assert_eq!(Arc::strong_count(&head.styles), 1);
}

#[test]
fn a_head_without_watch_mapping_still_lends_its_own_stylesheet_store() {
    let mut head = runtime_with_base(None);
    head.watch_resolution = false;
    let base = head.for_base(Arc::new(Unimock::new(())), "version".into(), None);
    assert_eq!(
        base.head_styles
            .as_ref()
            .and_then(Weak::upgrade)
            .as_ref()
            .map(|store| Arc::ptr_eq(store, &head.styles)),
        Some(true),
        "a head without watch mapping must lend its own stylesheet store"
    );
}

#[test]
fn directly_constructed_bases_never_lend_their_own_stylesheet_store() {
    let base = runtime_with_base(Some(base_side()));
    let nested = base.for_base(Arc::new(Unimock::new(())), "version".into(), None);
    assert!(base.head_styles.is_some());
    assert!(nested.head_styles.is_some());
    assert!(base.head_styles.as_ref().and_then(Weak::upgrade).is_none());
    assert!(
        nested
            .head_styles
            .as_ref()
            .and_then(Weak::upgrade)
            .is_none()
    );
    assert_eq!(Arc::strong_count(&base.styles), 1);
}

#[test]
fn nested_bases_preserve_an_expired_original_head_source() {
    let base = {
        let head = runtime_with_base(None);
        head.for_base(Arc::new(Unimock::new(())), "version".into(), None)
    };
    assert!(
        base.head_styles
            .as_ref()
            .is_some_and(|source| source.upgrade().is_none())
    );
    let nested = base.for_base(Arc::new(Unimock::new(())), "version".into(), None);
    assert_eq!(
        nested
            .head_styles
            .as_ref()
            .zip(base.head_styles.as_ref())
            .map(|(borrowed, original)| Weak::ptr_eq(borrowed, original)),
        Some(true)
    );
    assert!(
        nested
            .head_styles
            .as_ref()
            .is_some_and(|source| source.upgrade().is_none())
    );
    assert_eq!(Arc::strong_count(&base.styles), 1);
}
