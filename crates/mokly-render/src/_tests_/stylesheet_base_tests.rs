//! Historical fallback validates records without changing head ownership or store bounds.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_css::types::StylesheetBundler;
use mokly_source_interface::read_evidence::ReadBaseline;
use unimock::{MockFn, Unimock, matching};

use crate::recorded_calls::lock_calls;
use crate::source_paths::SOURCE_INPUT_PREFIX;
use crate::stylesheet_compiler::CompileRoot;
use crate::stylesheet_store::{Miss, StylesheetCache};

use super::stylesheet_support::{
    Calls, MODULES, assert_same, attempt, bundle, bundler, charges, compiled, fill, key, module,
    root, roots, tree,
};

#[test]
fn head_hits_share_payload_validate_context_once_and_replay_original_evidence() {
    let head = Arc::new(Mutex::new(StylesheetCache::default()));
    let roots = roots(2);
    fill(&head, &roots);
    let original = head.lock().unwrap().record(&key(&roots[0])).unwrap();
    let calls = Arc::new(Calls::default());
    let own = Arc::new(Mutex::new(StylesheetCache::default()));
    let base = attempt(Arc::new(Unimock::new(())), tree(&calls, &[]), &own)
        .with_head(Arc::downgrade(&head));
    assert_eq!(
        base.lookup(&key(&roots[0]))
            .map(|record| record.complete().css),
        Ok(bundle(&roots[0]).css)
    );
    for root in &roots {
        assert_same(&base.bundle(root).unwrap(), &bundle(root));
    }
    assert!(Arc::ptr_eq(
        &base.lookup(&key(&roots[0])).unwrap(),
        &original
    ));
    assert!(Arc::ptr_eq(
        &head.lock().unwrap().record(&key(&roots[0])).unwrap(),
        &original
    ));
    assert!(own.lock().unwrap().record(&key(&roots[0])).is_none());
    assert_eq!(Calls::count(&calls.module_digests), MODULES);
    let observed = lock_calls(&calls.observed);
    let path = Path::new("/repo").join(module(0));
    assert_eq!(
        observed
            .iter()
            .filter(|(candidate, _)| *candidate == path)
            .count(),
        1
    );
    assert_eq!(
        observed
            .iter()
            .find(|(candidate, _)| *candidate == path)
            .unwrap()
            .1,
        bundle(&roots[0]).read_evidence.inputs[&module(0)]
    );
}

#[test]
fn a_valid_own_record_wins_and_an_invalid_one_falls_back_to_head() {
    let head = Arc::new(Mutex::new(StylesheetCache::default()));
    let own = Arc::new(Mutex::new(StylesheetCache::default()));
    let root = root("main.css");
    fill(&head, std::slice::from_ref(&root));
    let mut own_bundle = bundle(&root);
    own_bundle.css = "base output".into();
    own_bundle
        .read_evidence
        .inputs
        .get_mut(&format!("{SOURCE_INPUT_PREFIX}main.css"))
        .unwrap()
        .clear();
    own_bundle.read_evidence.insert(
        format!("{SOURCE_INPUT_PREFIX}main.css"),
        ReadBaseline::Late("1".repeat(64)),
    );
    let initial = attempt(
        Arc::new(Unimock::new(
            CompileRoot
                .some_call(matching!(_))
                .returns(Ok(compiled(own_bundle))),
        )),
        tree(&Arc::default(), &["main.css"]),
        &own,
    );
    initial.bundle(&root).unwrap();
    let valid = attempt(
        Arc::new(Unimock::new(())),
        tree(&Arc::default(), &["main.css"]),
        &own,
    )
    .with_head(Arc::downgrade(&head));
    assert_eq!(valid.bundle(&root).unwrap().css, "base output");
    let changed = attempt(Arc::new(Unimock::new(())), tree(&Arc::default(), &[]), &own)
        .with_head(Arc::downgrade(&head));
    assert_eq!(
        changed
            .lookup(&key(&root))
            .map(|record| record.complete().css),
        Ok(bundle(&root).css)
    );
}

#[test]
fn a_failed_head_candidate_reports_stamp_mismatch_without_changing_it() {
    let head = Arc::new(Mutex::new(StylesheetCache::default()));
    let root = root("main.css");
    fill(&head, std::slice::from_ref(&root));
    let original = head.lock().unwrap().record(&key(&root)).unwrap();
    let own = Arc::new(Mutex::new(StylesheetCache::default()));
    let base = attempt(
        bundler(Arc::default()),
        tree(&Arc::default(), &["main.css"]),
        &own,
    )
    .with_head(Arc::downgrade(&head));
    assert_eq!(base.lookup(&key(&root)).err(), Some(Miss::StampMismatch));
    base.bundle(&root).unwrap();
    assert!(Arc::ptr_eq(
        &head.lock().unwrap().record(&key(&root)).unwrap(),
        &original
    ));
    assert!(own.lock().unwrap().record(&key(&root)).is_some());
}

#[test]
fn base_pressure_and_rejection_never_insert_reject_or_evict_head_records() {
    let head = Arc::new(Mutex::new(StylesheetCache::default()));
    let head_root = root("head.css");
    fill(&head, std::slice::from_ref(&head_root));
    let original = head.lock().unwrap().record(&key(&head_root)).unwrap();
    let (record, context) = charges(&tree(&Arc::default(), &[]));
    let own = Arc::new(Mutex::new(StylesheetCache::new(record + context + 1024)));
    let bundles = Arc::new(AtomicUsize::new(0));
    let base = attempt(bundler(bundles.clone()), tree(&Arc::default(), &[]), &own)
        .with_head(Arc::downgrade(&head));
    for root in roots(4) {
        base.bundle(&root).unwrap();
    }
    assert_eq!(bundles.load(Ordering::SeqCst), 4);
    assert!(own.lock().unwrap().record(&key(&roots(1)[0])).is_none());
    let rejected = root("rejected.css");
    let mut conflicting = bundle(&rejected);
    conflicting
        .read_evidence
        .insert(module(0), ReadBaseline::Late("1".repeat(64)));
    let reject = attempt(
        Arc::new(Unimock::new(
            CompileRoot
                .some_call(matching!(_))
                .returns(Ok(compiled(conflicting))),
        )),
        tree(&Arc::default(), &[]),
        &own,
    )
    .with_head(Arc::downgrade(&head));
    reject.bundle(&rejected).unwrap();
    assert_eq!(
        own.lock().unwrap().miss(&key(&rejected)),
        Miss::InconsistentEvidence
    );
    assert!(Arc::ptr_eq(
        &head.lock().unwrap().record(&key(&head_root)).unwrap(),
        &original
    ));
    assert!(head.lock().unwrap().record(&key(&rejected)).is_none());
    assert_eq!(head.lock().unwrap().miss(&key(&rejected)), Miss::NoRecord);
}

#[test]
fn a_live_base_does_not_keep_the_head_store_alive() {
    let record;
    {
        let (base, head) = {
            let head = Arc::new(Mutex::new(StylesheetCache::default()));
            let root = root("main.css");
            fill(&head, std::slice::from_ref(&root));
            record = Arc::downgrade(&head.lock().unwrap().record(&key(&root)).unwrap());
            let (bytes, context) = charges(&tree(&Arc::default(), &[]));
            let own = Arc::new(Mutex::new(StylesheetCache::new(bytes + context + 1024)));
            let base = attempt(bundler(Arc::default()), tree(&Arc::default(), &[]), &own)
                .with_head(Arc::downgrade(&head));
            assert!(base.lookup(&key(&root)).is_ok());
            (base, Arc::downgrade(&head))
        };
        assert!(head.upgrade().is_none());
        assert!(record.upgrade().is_some());
        assert_same(
            &base.bundle(&root("main.css")).unwrap(),
            &bundle(&root("main.css")),
        );
        base.bundle(&root("other.css")).unwrap();
        assert!(record.upgrade().is_none());
    }
    assert!(record.upgrade().is_none());
}

#[test]
fn an_absent_head_preserves_the_base_eviction_reason() {
    let own = Arc::new(Mutex::new(StylesheetCache::new(256)));
    let root = root("main.css");
    let first = attempt(bundler(Arc::default()), tree(&Arc::default(), &[]), &own);
    first.bundle(&root).unwrap();
    let next = attempt(Arc::new(Unimock::new(())), tree(&Arc::default(), &[]), &own);
    assert_eq!(next.lookup(&key(&root)).err(), Some(Miss::Evicted));
}
