//! Reservation, release, exhaustion and concurrent accounting regressions.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Barrier, mpsc};
use std::thread;

use mkc_upload_memory_interface::budget::{Error, UploadMemoryBudget};

use crate::budget::ProcessUploadMemoryBudget;

#[test]
fn reserves_exact_capacity_and_releases_it_on_final_drop() {
    let budget = ProcessUploadMemoryBudget::new(8);
    {
        let reservation = budget.reserve(8).unwrap();
        let shared = reservation.clone();
        assert!(matches!(
            budget.reserve(1),
            Err(Error::Exhausted {
                requested: 1,
                capacity: 8
            })
        ));
        {
            let _retained = shared;
        }
        assert!(budget.reserve(1).is_err());
    }
    assert!(budget.reserve(8).is_ok());
}

#[test]
fn reports_typed_exhaustion_without_partial_reservation() {
    let budget = ProcessUploadMemoryBudget::new(7);
    let _held = budget.reserve(5).unwrap();
    assert!(matches!(
        budget.reserve(3),
        Err(Error::Exhausted {
            requested: 3,
            capacity: 7,
        })
    ));
    assert!(budget.reserve(2).is_ok());
}

#[test]
fn concurrent_reservations_never_exceed_capacity() {
    const THREADS: usize = 64;
    let budget = Arc::new(ProcessUploadMemoryBudget::new(8));
    let started = Arc::new(Barrier::new(THREADS + 1));
    let release = Arc::new(Barrier::new(THREADS + 1));
    let (sender, receiver) = mpsc::channel();
    let mut workers = Vec::new();

    for _ in 0..THREADS {
        let budget = budget.clone();
        let started = started.clone();
        let release = release.clone();
        let sender = sender.clone();
        workers.push(thread::spawn(move || {
            started.wait();
            let reservation = budget.reserve(2);
            sender.send(reservation.is_ok()).unwrap();
            release.wait();
        }));
    }
    started.wait();
    let admitted = (0..THREADS).filter(|_| receiver.recv().unwrap()).count();
    assert_eq!(admitted, 4);
    release.wait();
    for worker in workers {
        worker.join().unwrap();
    }
    assert!(budget.reserve(8).is_ok());
}
