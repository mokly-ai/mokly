//! Deferred reads keep successful usage sets and the failing root's partial prefix.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_css::error::{CssError, InternalError};
use mokly_source_interface::error::SourceError;

use crate::dependency_usage::{DependencyUsage, UsedDependencies};
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheet_store::StylesheetCache;

use super::gate::ReverseGate;
use super::support::{attempt, compiled, inner, maps, roots, tree, watch};

#[test]
fn successful_parallel_roots_have_exactly_the_serial_dependency_usage_sets() {
    let mut results = Vec::new();
    for parallel in [false, true] {
        let usage = Arc::new(UsedDependencies::default());
        let observed = usage.clone();
        let gate = parallel.then(|| ReverseGate::new(4, 4));
        let events = Arc::new(Mutex::new(Vec::new()));
        let shared = Arc::new(Mutex::new(StylesheetCache::default()));
        let compiler = attempt(
            inner(
                Arc::new(move |root, buffered| {
                    if let Some(gate) = &gate {
                        gate.enter(root);
                        assert_eq!(observed.directories(), Vec::<String>::new());
                        assert_eq!(observed.unmapped_directories(), Vec::<String>::new());
                    }
                    let aliases = BTreeMap::from([(
                        format!("packages/{}/node_modules", root.path),
                        "node_modules".into(),
                    )]);
                    buffered.record(&aliases, "node_modules/theme/skin.css");
                    buffered.record(
                        &Default::default(),
                        &format!("{}-source/node_modules/theme/skin.css", root.path),
                    );
                    buffered.unmapped(&format!("/outside/{}/node_modules", root.path));
                    Ok(compiled(root))
                }),
                usage.clone(),
                watch(events.clone()),
                true,
            ),
            tree(events),
            &shared,
        );
        assert_eq!(
            compiler
                .class_maps(&roots(4), if parallel { 4 } else { 1 })
                .unwrap(),
            maps("r3.css")
        );
        results.push((usage.directories(), usage.unmapped_directories()));
    }
    assert_eq!(results[1], results[0]);
    assert_eq!(
        results[1].0,
        [
            "packages/r0.css/node_modules",
            "packages/r1.css/node_modules",
            "packages/r2.css/node_modules",
            "packages/r3.css/node_modules",
            "r0.css-source/node_modules",
            "r1.css-source/node_modules",
            "r2.css-source/node_modules",
            "r3.css-source/node_modules"
        ]
    );
    assert_eq!(
        results[1].1,
        [
            "/outside/r0.css/node_modules",
            "/outside/r1.css/node_modules",
            "/outside/r2.css/node_modules",
            "/outside/r3.css/node_modules"
        ]
    );
}

#[test]
fn a_cancelled_root_replays_its_partial_usage_but_no_later_root_usage() {
    let mut results = Vec::new();
    for parallel in [false, true] {
        let usage = Arc::new(UsedDependencies::default());
        let gate = parallel.then(|| ReverseGate::new(4, 4));
        let events = Arc::new(Mutex::new(Vec::new()));
        let shared = Arc::new(Mutex::new(StylesheetCache::default()));
        let compiler = attempt(
            inner(
                Arc::new(move |root, buffered| {
                    if let Some(gate) = &gate {
                        gate.enter(root);
                    }
                    buffered.record(
                        &Default::default(),
                        &format!("{}/node_modules/theme/skin.css", root.path),
                    );
                    buffered.unmapped(&format!("/outside/{}/node_modules", root.path));
                    if root.path == "r1.css" {
                        return Err(CssError::Internal(InternalError::Provider {
                            source: Box::new(SourceError::Cancelled {
                                path: "/repo/r1.css".into(),
                            }),
                        }));
                    }
                    Ok(compiled(root))
                }),
                usage.clone(),
                watch(events.clone()),
                true,
            ),
            tree(events),
            &shared,
        );
        let error = compiler
            .class_maps(&roots(5), if parallel { 4 } else { 1 })
            .unwrap_err();
        let CssError::Internal(InternalError::Provider { source }) = error else {
            panic!("cancellation must stay typed")
        };
        assert!(
            matches!(source.downcast_ref::<SourceError>(), Some(SourceError::Cancelled { path }) if path == std::path::Path::new("/repo/r1.css"))
        );
        results.push((usage.directories(), usage.unmapped_directories()));
    }
    assert_eq!(results[1], results[0]);
    assert_eq!(results[1].0, ["r0.css/node_modules", "r1.css/node_modules"]);
    assert_eq!(
        results[1].1,
        [
            "/outside/r0.css/node_modules",
            "/outside/r1.css/node_modules"
        ]
    );
}
