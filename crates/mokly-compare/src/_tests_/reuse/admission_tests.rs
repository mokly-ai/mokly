//! Reuse requires accepted complete content and invalidates changed or uncertain inputs.

use std::sync::atomic::Ordering;

use crate::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};

use super::base_support::reader;
use super::support::{Fixture, engine, request, review};

#[test]
fn prepared_head_validation_is_consumed_only_by_the_same_generation() {
    let store = MemoryComparisons::new(1024 * 1024);
    let fixture = Fixture::default();
    let request = request();
    let before = fixture.generation(false, true);
    let after = fixture.generation(true, true);
    let baseline = store.begin(engine(), ReuseFence::new(&"settings"));
    let expected = baseline
        .compare_prepared(&request, before.clone(), after.clone())
        .unwrap();
    baseline.discard();
    assert_eq!(fixture.head_validations.load(Ordering::SeqCst), 1);

    let attempt = store.begin(engine(), ReuseFence::new(&"settings"));
    attempt.prepare_head(&request, &after);
    assert_eq!(
        fixture.head_validations.load(Ordering::SeqCst),
        2,
        "head validation finishes before comparison"
    );
    let result = attempt
        .compare_prepared(&request, before.clone(), after.clone())
        .unwrap();
    assert_eq!(fixture.head_validations.load(Ordering::SeqCst), 2);
    assert_eq!(review(&result), review(&expected));
    assert_eq!(
        serde_json::to_vec(&result.snapshot).unwrap(),
        serde_json::to_vec(&expected.snapshot).unwrap()
    );
    assert_eq!(result.warnings, expected.warnings);
    attempt.discard();

    let replacement = store.begin(engine(), ReuseFence::new(&"settings"));
    replacement.prepare_head(&request, &after);
    let different_head = fixture.generation(true, true);
    let result = replacement
        .compare_prepared(&request, before, different_head)
        .unwrap();
    assert_eq!(fixture.head_validations.load(Ordering::SeqCst), 4);
    assert_eq!(review(&result), review(&expected));
}

#[test]
fn accepted_views_skip_preparation_but_changed_and_unknown_views_compare() {
    let store = MemoryComparisons::new(1024 * 1024);
    let before = Fixture {
        workers: true,
        ..Fixture::default()
    };
    let mut after = before.clone();
    let mut previous = reader(before.generation(false, true));
    let mut current = after.generation(true, true);
    let initial = store.begin(engine(), ReuseFence::new(&"settings"));
    let expected = initial
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!(initial.work().compared, 2);
    initial.accept();
    previous = reader(before.generation(false, true));
    before.clear();
    let same = store.begin(engine(), ReuseFence::new(&"settings"));
    let result = same
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!(review(&result), review(&expected));
    assert_eq!(
        (same.work().reused, same.work().compared, before.reads()),
        (2, 0, 0)
    );
    {
        let proofs = before.proof_threads.lock().unwrap();
        assert_eq!(proofs.len(), 2);
        assert!(
            proofs
                .iter()
                .all(|worker| *worker != std::thread::current().id())
        );
    }
    same.accept();
    after.html.insert("two".into(), "<p>edited</p>".into());
    current = after.generation(true, true);
    let edit = store.begin(engine(), ReuseFence::new(&"settings"));
    edit.compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!((edit.work().reused, edit.work().compared), (1, 1));
    edit.accept();
    let mut replacement = before.clone();
    replacement
        .html
        .insert("one".into(), "<p>replacement base</p>".into());
    previous = reader(replacement.generation(false, true));
    let replaced = store.begin(engine(), ReuseFence::new(&"settings"));
    replaced
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!((replaced.work().reused, replaced.work().compared), (1, 1));
    replaced.accept();
    after.known = false;
    current = after.generation(true, true);
    let uncertain = store.begin(engine(), ReuseFence::new(&"settings"));
    uncertain
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!((uncertain.work().reused, uncertain.work().compared), (0, 2));
}

#[test]
fn unaccepted_or_overflowing_attempts_cannot_install_partial_evidence() {
    let store = MemoryComparisons::new(1024 * 1024);
    let fixture = Fixture::default();
    let previous = fixture.generation(false, true);
    let current = fixture.generation(true, true);
    let first = store.begin(engine(), ReuseFence::new(&"settings"));
    first
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    first.discard();
    let unaccepted = store.begin(engine(), ReuseFence::new(&"settings"));
    unaccepted
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!(
        (unaccepted.work().reused, unaccepted.work().compared),
        (0, 2)
    );
    let tiny = MemoryComparisons::new(1);
    let previous = fixture.generation(false, false);
    let current = fixture.generation(true, false);
    let overflowing = tiny.begin(engine(), ReuseFence::new(&"settings"));
    overflowing
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    overflowing.accept();
    let next = tiny.begin(engine(), ReuseFence::new(&"settings"));
    next.compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!((next.work().reused, next.work().compared), (0, 2));
    assert_eq!(next.work().retained_bytes, 0);
}
