//! Reuse requires accepted complete content and invalidates changed or uncertain inputs.

use crate::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};

use super::support::{Fixture, engine, request, review};

#[test]
fn accepted_views_skip_preparation_but_changed_and_unknown_views_compare() {
    let store = MemoryComparisons::new(1024 * 1024);
    let before = Fixture {
        workers: true,
        ..Fixture::default()
    };
    let mut after = before.clone();
    let previous = before.generation(false, true);
    let mut current = after.generation(true, true);
    let initial = store.begin(engine(), ReuseFence::new(&"settings"));
    let expected = initial
        .compare_prepared(&request(), previous.clone(), current.clone())
        .unwrap();
    assert_eq!(initial.work().compared, 2);
    initial.accept();
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
