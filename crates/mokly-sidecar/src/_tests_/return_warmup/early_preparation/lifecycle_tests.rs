//! Pending early calls end at publication, bundle boundaries, final release, and stop.

use std::sync::Arc;
use std::thread;

use crate::pool::SidecarPool;

use super::super::calls::{call, maps};
use super::super::support::Gate;
use super::support::{edit, paired, start, step};

#[test]
fn publication_and_a_second_bundle_end_the_pending_generation() {
    for publication in [true, false] {
        let harness = paired(Arc::new(|_| Ok(())));
        start(&harness, "new");
        assert!(step(&harness), "the early disposal starts");
        assert!(step(&harness));
        if publication {
            harness.pool.head_published();
        } else {
            harness.pool.request(edit("second")).unwrap();
        }
        harness.pool.request(maps("new")).unwrap();
        let before = harness.events.quiet(1);
        if publication {
            assert!(!step(&harness), "publication stops incomplete preparation");
        }
        assert_eq!(harness.events.quiet(1), before);
        harness.pool.abort().unwrap();
    }
}

#[test]
fn final_release_disposes_an_early_restore_that_returns_after_its_lifetime() {
    for superseded in [false, true] {
        let restore = Arc::new(Gate::default());
        let held = restore.clone();
        let harness = paired(Arc::new(move |event| {
            if *event == call(1, "restoreGeneration new") {
                held.block();
            }
            Ok(())
        }));
        start(&harness, "new");
        assert!(step(&harness), "the early disposal starts");
        let pool = harness.pool.clone();
        let restoring = thread::spawn(move || pool.maintain_head_preparation().unwrap());
        restore.entered();
        if superseded {
            harness.pool.request(edit("newest")).unwrap();
        }
        harness.pool.release_generation("new", 2);
        restore.open();
        assert!(restoring.join().unwrap());
        assert_eq!(
            &harness.events.calls(1)[harness.events.calls(1).len() - 2..],
            ["restoreGeneration new", "dispose new"]
        );
        assert_eq!(
            step(&harness),
            superseded,
            "a newer bundle can start its own preparation after the old return"
        );
        harness.pool.abort().unwrap();
    }
}
