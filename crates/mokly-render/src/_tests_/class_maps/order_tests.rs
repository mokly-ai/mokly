//! Reverse worker exits cannot reorder maps, observations, watches, or cache inserts.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_css::types::StylesheetBundler;
use mokly_test_support::capture::Trace;

use crate::dependency_usage::UsedDependencies;
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::stylesheet_record::Record;
use crate::stylesheet_store::{Miss, StylesheetCache};

use super::gate::ReverseGate;
use super::support::{attempt, compiled, inner, key, maps, roots, tree, watch};

#[test]
fn reversed_chunks_keep_root_order_and_caller_tracing_with_four_workers() {
    let roots = roots(6);
    let gate = ReverseGate::new(6, 4);
    let events = Arc::new(Mutex::new(Vec::new()));
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let running = gate.clone();
    let locked = shared.clone();
    let compiler = attempt(
        inner(
            Arc::new(move |root, _| {
                running.enter(root);
                assert!(
                    locked.try_lock().is_err(),
                    "batch must hold the shared store"
                );
                Ok(compiled(root))
            }),
            Arc::new(UsedDependencies::default()),
            watch(events.clone()),
            true,
        ),
        tree(events.clone()),
        &shared,
    );
    let trace = Trace::default();
    let result = trace.in_scope(|| {
        let caller = tracing::info_span!("class-map-caller");
        caller.in_scope(|| compiler.class_maps(&roots, 8).unwrap())
    });
    assert_eq!(result, maps("r5.css"));
    assert_eq!(*gate.exited.lock().unwrap(), [3, 2, 1, 0, 5, 4]);
    assert_eq!(gate.active.load(Ordering::SeqCst), 0);
    assert_eq!(gate.peak.load(Ordering::SeqCst), 4);
    assert_eq!(
        *events.lock().unwrap(),
        [
            format!("observe:{}", Path::new("/repo").join("r0.css").display()),
            "watch:r0.css".into(),
            format!("observe:{}", Path::new("/repo").join("r1.css").display()),
            "watch:r1.css".into(),
            format!("observe:{}", Path::new("/repo").join("r2.css").display()),
            "watch:r2.css".into(),
            format!("observe:{}", Path::new("/repo").join("r3.css").display()),
            "watch:r3.css".into(),
            format!("observe:{}", Path::new("/repo").join("r4.css").display()),
            "watch:r4.css".into(),
            format!("observe:{}", Path::new("/repo").join("r5.css").display()),
            "watch:r5.css".into(),
        ]
    );
    let spans = trace.spans();
    let bundles: Vec<_> = spans
        .iter()
        .filter(|span| span.name == "css.bundle")
        .collect();
    assert_eq!(bundles.len(), 6);
    for bundle in bundles {
        assert_eq!(bundle.parent_name, Some("class-map-caller"));
        assert_eq!(
            bundle.fields.get("cache").map(String::as_str),
            Some("no-record")
        );
    }
    assert!(shared.try_lock().is_ok());
    let before = trace.spans().len();
    trace.in_scope(|| compiler.bundle(&roots[5]).unwrap());
    assert_eq!(
        trace.spans().len(),
        before,
        "a retained root makes no bundle span"
    );
}

#[test]
fn small_stores_keep_the_serial_evictions_misses_and_formatted_key_charges() {
    for capacity_boundary in [false, true] {
        let roots = roots(if capacity_boundary { 2 } else { 4 });
        let events = Arc::new(Mutex::new(Vec::new()));
        let tree = tree(events.clone());
        let record = Record::new(
            tree.as_ref(),
            std::path::Path::new("/repo"),
            compiled(&roots[0]),
            |_, _| panic!("plain CSS has no context"),
        );
        let formatted = key(&roots[0]);
        let shared_charge = size_of::<String>() + formatted.len() + record.bytes;
        let local_charge = size_of::<String>() + formatted.capacity() + record.bytes;
        assert!(local_charge > shared_charge);
        let limit = if capacity_boundary {
            2 * shared_charge
        } else {
            shared_charge + shared_charge / 2
        };
        let shared = Arc::new(Mutex::new(StylesheetCache::new(limit)));
        let gate = ReverseGate::new(roots.len(), roots.len());
        let running = gate.clone();
        let compiler = attempt(
            inner(
                Arc::new(move |root, _| {
                    running.enter(root);
                    Ok(compiled(root))
                }),
                Arc::new(UsedDependencies::default()),
                watch(events),
                true,
            ),
            tree,
            &shared,
        );
        let trace = Trace::default();
        assert_eq!(
            trace.in_scope(|| compiler.class_maps(&roots, 4).unwrap()),
            maps(if capacity_boundary {
                "r1.css"
            } else {
                "r3.css"
            })
        );
        let shared = shared.lock().unwrap();
        let local = compiler.local.lock().unwrap();
        let expected_shared = if capacity_boundary {
            vec![true, true]
        } else {
            vec![false, false, false, true]
        };
        let expected_local = if capacity_boundary {
            vec![false, true]
        } else {
            vec![false, false, false, true]
        };
        assert_eq!(
            roots
                .iter()
                .map(|root| shared.record(&key(root)).is_some())
                .collect::<Vec<_>>(),
            expected_shared
        );
        assert_eq!(
            roots
                .iter()
                .map(|root| local.record(&key(root)).is_some())
                .collect::<Vec<_>>(),
            expected_local
        );
        for root in &roots[..roots.len() - 1] {
            assert_eq!(local.miss(&key(root)), Miss::Evicted);
        }
        assert_eq!(
            roots
                .iter()
                .map(|root| shared.miss(&key(root)))
                .collect::<Vec<_>>(),
            if capacity_boundary {
                vec![Miss::NoRecord, Miss::NoRecord]
            } else {
                vec![Miss::Evicted, Miss::Evicted, Miss::Evicted, Miss::NoRecord]
            }
        );
        assert_eq!(shared.miss(&key(roots.last().unwrap())), Miss::NoRecord);
        assert_eq!(local.miss(&key(roots.last().unwrap())), Miss::NoRecord);
        let reasons: BTreeSet<_> = trace
            .spans()
            .into_iter()
            .filter(|span| span.name == "css.bundle")
            .map(|span| span.fields["cache"].clone())
            .collect();
        assert_eq!(reasons, BTreeSet::from(["no-record".into()]));
    }
}
