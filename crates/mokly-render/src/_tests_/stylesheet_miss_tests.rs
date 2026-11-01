//! A stylesheet that the cache cannot serve gets the reason that its `css.bundle` span records.

use std::sync::{Arc, Mutex};

use mokly_css::types::{StylesheetBundler, StylesheetBundlerMock};
use mokly_source_interface::read_evidence::ReadBaseline;
use unimock::{MockFn, Unimock, matching};

use super::stylesheet_support::{attempt, bundle, charges, fill, key, module, root, roots, tree};
use crate::stylesheet_store::{Miss, StylesheetCache};

fn unchanged(shared: &Arc<Mutex<StylesheetCache>>) -> crate::stylesheet_cache::CachedStylesheets {
    attempt(
        Arc::new(Unimock::new(())),
        tree(&Arc::default(), &[]),
        shared,
    )
}

#[test]
fn a_key_that_no_attempt_bundled_misses_with_no_record() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let attempt = unchanged(&shared);
    assert_eq!(
        attempt.lookup(&key(&root("a.css"))).err(),
        Some(Miss::NoRecord)
    );
}

#[test]
fn a_record_that_the_byte_bound_removed_misses_with_evicted() {
    let (record, context) = charges(&tree(&Arc::default(), &[]));
    let roots = roots(2);
    let bound = key(&roots[0]).len() + record + context + record / 2;
    let shared = Arc::new(Mutex::new(StylesheetCache::new(bound)));
    fill(&shared, &roots);
    let attempt = unchanged(&shared);
    assert_eq!(attempt.lookup(&key(&roots[0])).err(), Some(Miss::Evicted));
    assert!(attempt.lookup(&key(&roots[1])).is_ok());
}

#[test]
fn a_record_whose_own_input_changed_misses_with_stamp_mismatch() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let roots = roots(2);
    fill(&shared, &roots);
    let attempt = attempt(
        Arc::new(Unimock::new(())),
        tree(&Arc::default(), &["/root-00.css"]),
        &shared,
    );
    assert_eq!(
        attempt.lookup(&key(&roots[0])).err(),
        Some(Miss::StampMismatch)
    );
    assert!(attempt.lookup(&key(&roots[1])).is_ok());
}

#[test]
fn a_record_with_disagreeing_evidence_misses_with_inconsistent_evidence() {
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let root = root("a.css");
    let mut disagreeing = bundle(&root);
    disagreeing
        .read_evidence
        .insert(module(0), ReadBaseline::Late("1".repeat(64)));
    let first = attempt(
        Arc::new(Unimock::new(
            StylesheetBundlerMock::bundle
                .next_call(matching!(_))
                .returns(Ok(disagreeing)),
        )),
        tree(&Arc::default(), &[]),
        &shared,
    );
    first.bundle(&root).unwrap();
    assert!(first.lookup(&key(&root)).is_ok());
    assert_eq!(
        unchanged(&shared).lookup(&key(&root)).err(),
        Some(Miss::InconsistentEvidence)
    );
}
