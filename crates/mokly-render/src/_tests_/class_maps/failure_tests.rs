//! Errors, cancellations, and panics retain only the effects serial execution reaches.

use std::collections::BTreeSet;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_css::error::{CssError, InternalError};
use mokly_source_interface::error::SourceError;
use mokly_test_support::capture::Trace;

use crate::dependency_usage::{DependencyUsage, UsedDependencies};
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheet_store::{Miss, StylesheetCache};

use super::gate::ReverseGate;
use super::support::{attempt, compiled, inner, key, roots, tree, watch};

#[test]
fn reversed_errors_return_the_first_root_error_and_join_the_chunk() {
    let roots = roots(6);
    let gate = ReverseGate::new(4, 4);
    let running = gate.clone();
    let events = Arc::new(Mutex::new(Vec::new()));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let compiler = attempt(
        inner(
            Arc::new(move |root, _| {
                running.enter(root);
                match root.path.as_str() {
                    "r1.css" | "r3.css" => Err(CssError::RootRoute {
                        path: root.path.clone(),
                    }),
                    _ => Ok(compiled(root)),
                }
            }),
            Arc::new(UsedDependencies::default()),
            watch(events.clone()),
            true,
        ),
        tree(events.clone()),
        &shared,
    );
    let trace = Trace::default();
    let result = trace.in_scope(|| compiler.class_maps(&roots, 4));
    assert!(matches!(result, Err(CssError::RootRoute { path }) if path == "r1.css"));
    assert_eq!(*gate.exited.lock().unwrap(), [3, 2, 1, 0]);
    assert_eq!(gate.active.load(Ordering::SeqCst), 0);
    let started: BTreeSet<_> = gate.started.lock().unwrap().iter().copied().collect();
    assert_eq!(started, BTreeSet::from([0, 1, 2, 3]));
    assert_eq!(
        *events.lock().unwrap(),
        ["observe:/repo/r0.css", "watch:r0.css"]
    );
    for store in [&*shared.lock().unwrap(), &*compiler.local.lock().unwrap()] {
        assert_eq!(
            roots
                .iter()
                .map(|root| store.record(&key(root)).is_some())
                .collect::<Vec<_>>(),
            [true, false, false, false, false, false]
        );
        assert_eq!(
            roots
                .iter()
                .map(|root| store.miss(&key(root)))
                .collect::<Vec<_>>(),
            vec![Miss::NoRecord; 6]
        );
    }
    let errors = trace
        .events()
        .into_iter()
        .filter(|event| event.fields.iter().any(|(name, _)| name == "error"))
        .count();
    assert_eq!(
        errors, 2,
        "both failed raw bundles retain their error event"
    );
}

#[test]
fn watch_cancellation_keeps_the_inserted_root_and_joins_later_workers() {
    let roots = roots(5);
    let gate = ReverseGate::new(4, 4);
    let running = gate.clone();
    let events = Arc::new(Mutex::new(Vec::new()));
    let watched = events.clone();
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let compiler = attempt(
        inner(
            Arc::new(move |root, _| {
                running.enter(root);
                Ok(compiled(root))
            }),
            Arc::new(UsedDependencies::default()),
            Arc::new(move |files| {
                watched
                    .lock()
                    .unwrap()
                    .push(format!("watch:{}", files.first().unwrap()));
                Err(CssError::Internal(InternalError::Provider {
                    source: Box::new(SourceError::Cancelled {
                        path: "/repo/r0.css".into(),
                    }),
                }))
            }),
            true,
        ),
        tree(events.clone()),
        &shared,
    );
    let error = compiler.class_maps(&roots, 4).unwrap_err();
    let CssError::Internal(InternalError::Provider { source }) = error else {
        panic!("watch error must stay typed")
    };
    assert!(
        matches!(source.downcast_ref::<SourceError>(), Some(SourceError::Cancelled { path }) if path == std::path::Path::new("/repo/r0.css"))
    );
    assert_eq!(*gate.exited.lock().unwrap(), [3, 2, 1, 0]);
    assert_eq!(gate.active.load(Ordering::SeqCst), 0);
    assert_eq!(
        *events.lock().unwrap(),
        ["observe:/repo/r0.css", "watch:r0.css"]
    );
    for store in [&*shared.lock().unwrap(), &*compiler.local.lock().unwrap()] {
        assert_eq!(
            roots
                .iter()
                .map(|root| store.record(&key(root)).is_some())
                .collect::<Vec<_>>(),
            [true, false, false, false, false]
        );
    }
}

#[test]
fn a_worker_panic_resumes_its_payload_after_committing_the_prior_root() {
    let roots = roots(5);
    let gate = ReverseGate::new(4, 4);
    let running = gate.clone();
    let events = Arc::new(Mutex::new(Vec::new()));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let usage = Arc::new(UsedDependencies::default());
    let compiler = attempt(
        inner(
            Arc::new(move |root, buffered| {
                running.enter(root);
                buffered.record(
                    &Default::default(),
                    &format!("{}/node_modules/theme.css", root.path),
                );
                assert_ne!(root.path, "r1.css", "root-one-panic");
                Ok(compiled(root))
            }),
            usage.clone(),
            watch(events.clone()),
            true,
        ),
        tree(events.clone()),
        &shared,
    );
    let payload = catch_unwind(AssertUnwindSafe(|| compiler.class_maps(&roots, 4))).unwrap_err();
    let message = payload.downcast_ref::<String>().unwrap();
    assert!(message.contains("root-one-panic"));
    assert_eq!(*gate.exited.lock().unwrap(), [3, 2, 1, 0]);
    assert_eq!(
        usage.directories(),
        ["r0.css/node_modules", "r1.css/node_modules"]
    );
    assert_eq!(gate.active.load(Ordering::SeqCst), 0);
    assert_eq!(
        *events.lock().unwrap(),
        ["observe:/repo/r0.css", "watch:r0.css"]
    );
    let store = shared.lock().unwrap_or_else(|error| error.into_inner());
    assert_eq!(
        roots
            .iter()
            .map(|root| store.record(&key(root)).is_some())
            .collect::<Vec<_>>(),
        [true, false, false, false, false]
    );
}
