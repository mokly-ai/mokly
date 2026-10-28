//! The module evidence of one PostCSS context is stored and checked once for all of its bundles.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_css::types::StylesheetBundler;
use unimock::Unimock;

use super::stylesheet_support::{
    Calls, MODULES, assert_same, attempt, bundle, bundler, charges, fill, key, module, roots, tree,
};
use crate::stylesheet_store::{Miss, StylesheetCache};

const BOUND: usize = 64 * 1024 * 1024;

#[test]
fn thirty_nine_records_with_shared_module_evidence_fit_in_one_store() {
    let tree = tree(&Arc::default(), &[]);
    let (record, context) = charges(&tree);
    assert!(39 * (record + context) > BOUND);
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let calls = Arc::new(AtomicUsize::new(0));
    let first = attempt(bundler(calls.clone()), tree.clone(), &shared);
    for root in roots(39) {
        first.bundle(&root).unwrap();
    }
    assert_eq!(calls.load(Ordering::SeqCst), 39);
    let second = attempt(Arc::new(Unimock::new(())), tree, &shared);
    for root in roots(39) {
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
    }
}

/// The tree calls of a second attempt that hits `count` roots.
fn hit_calls(count: usize) -> Arc<Calls> {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, &roots(count));
    let calls = Arc::new(Calls::default());
    let second = attempt(Arc::new(Unimock::new(())), tree(&calls, &[]), &shared);
    for root in roots(count) {
        second.bundle(&root).unwrap();
    }
    calls
}

#[test]
fn hits_check_the_shared_module_stamp_once_for_each_attempt() {
    let (small, large) = (hit_calls(2), hit_calls(8));
    assert_eq!(Calls::count(&small.module_digests), MODULES);
    assert_eq!(Calls::count(&large.module_digests), MODULES);
    assert_eq!(Calls::count(&small.identities), MODULES);
    assert_eq!(Calls::count(&large.identities), MODULES);
    assert!(Calls::count(&small.other_digests) > 0);
    assert_eq!(
        Calls::count(&large.other_digests),
        Calls::count(&small.other_digests) * 4
    );
}

#[test]
fn a_hit_returns_the_bundle_of_its_miss_and_replays_the_same_observations() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let (missed, hit) = (Arc::new(Calls::default()), Arc::new(Calls::default()));
    let first = attempt(bundler(Arc::default()), tree(&missed, &[]), &shared);
    let second = attempt(Arc::new(Unimock::new(())), tree(&hit, &[]), &shared);
    for root in roots(2) {
        assert_same(&first.bundle(&root).unwrap(), &bundle(&root));
    }
    for root in roots(2) {
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
        assert_same(&second.bundle(&root).unwrap(), &bundle(&root));
    }
    let mut missed = missed.observed.lock().unwrap().clone();
    let mut hit = hit.observed.lock().unwrap().clone();
    assert_eq!(missed.len(), MODULES + 2);
    assert_eq!(hit.len(), MODULES + 4);
    let module = Path::new("/repo").join(module(0));
    assert_eq!(hit.iter().filter(|(path, _)| *path == module).count(), 1);
    missed.sort();
    hit.sort();
    hit.dedup();
    assert_eq!(hit, missed);
}

#[test]
fn a_changed_module_file_makes_every_record_of_its_context_miss_with_stamp_mismatch() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    fill(&shared, &roots(3));
    let calls = Arc::new(Calls::default());
    let second = attempt(
        Arc::new(Unimock::new(())),
        tree(&calls, &["module-000.js"]),
        &shared,
    );
    for root in roots(3) {
        assert_eq!(second.lookup(&key(&root)).err(), Some(Miss::StampMismatch));
    }
    assert_eq!(Calls::count(&calls.module_digests), MODULES);
}
