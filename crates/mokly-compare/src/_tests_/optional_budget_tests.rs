//! Optional allocations cannot change comparison admission, even while a proof drains.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::reuse_budget::Resident;
use mokly_graph::workers::{ComparisonTask, ComparisonTaskMock};

#[test]
fn comparisons_fit_exactly_when_optional_arena_would_fill_the_bound() {
    let without = Resident::new(1024);
    let first = without.reserve(400).unwrap();
    assert_eq!(without.reserve(624).unwrap().bytes(), 624);
    let with = Resident::new(1024);
    let comparison = with.reserve(400).unwrap();
    let _facts = with.register_optional(512).unwrap();
    let admitted = with.reserve(624).map(|charge| charge.bytes());
    assert_eq!(
        admitted,
        Some(624),
        "optional facts must be reclaimed before comparison admission"
    );
    assert_eq!(comparison.bytes(), first.bytes());
}

#[test]
fn draining_proof_releases_all_optional_owners_before_comparison_admission() {
    let resident = Resident::new(1024);
    let owner = resident.register_optional(512).unwrap();
    let (entered, started) = mpsc::channel();
    let (reclaiming, snapshot_taken) = mpsc::channel();
    let snapshot_taken = Mutex::new(snapshot_taken);
    let optional = resident.clone();
    let task: Arc<dyn ComparisonTask> = Arc::new(Unimock::new(
        ComparisonTaskMock::run
            .some_call(matching!(0))
            .answers_arc(Arc::new(move |_, _| {
                entered.send(()).unwrap();
                snapshot_taken.lock().unwrap().recv().unwrap();
                assert_eq!(optional.reserve_optional(1).map(|charge| charge.bytes()), None,
                    "optional proof reservations must fail without reclamation while mandatory admission owns the gate");
            })),
    ));
    thread::scope(|scope| {
        let proof = scope.spawn(|| {
            resident.with_optional([Some(owner.id), None], |arenas| {
                let _facts = arenas[0].unwrap().data.read().unwrap();
                task.run(0);
            })
        });
        started.recv().unwrap();
        let admission = scope.spawn(|| {
            let _gate = resident.admission.write().unwrap();
            let snapshot = resident.eviction_snapshot();
            reclaiming.send(()).unwrap();
            resident.reclaim_snapshot(snapshot);
            resident
                .try_reserve(1024, false)
                .map(|charge| charge.bytes())
        });
        proof.join().unwrap();
        assert_eq!(admission.join().unwrap(), Some(1024));
    });
    assert_eq!(resident.fact_bytes(), 0);
}
