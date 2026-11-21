//! Deferred seeding preserves keys, and public edit calculation never waits for a seed.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::{Arc, Barrier};
use std::thread;

use crate::render_calculation;
use crate::render_inputs::RenderKeys;

use super::support::{Fixture, fallback};

#[test]
fn explicit_seed_preserves_full_keys_and_supplies_reuse_without_exporter_work() {
    let fixture = Fixture::new();
    let (startup, jobs) = fixture.unseeded();
    let empty_bytes = startup.reuse_facts_bytes();
    startup.seed_with(|| render_calculation::facts(&fixture.inputs()));
    assert_eq!(fixture.jobs(), jobs, "seed runs no exporter job");
    assert!(startup.reuse_facts_bytes() > empty_bytes);
    let full = RenderKeys::build(&fixture.inputs(), fallback());
    assert_eq!(startup.modules, full.modules);
    startup.seed_with(|| panic!("an initialized generation cannot seed twice"));
    let (current, jobs) = fixture.reuse(Some(&startup));
    assert_eq!(jobs, 0);
    assert_eq!(current.modules, full.modules);
}

#[test]
fn edit_uses_full_current_keys_while_predecessor_seed_is_in_progress() {
    let fixture = Fixture::new();
    let (startup, _) = fixture.unseeded();
    let mut edited = fixture.clone();
    edited.digest("lib/leaf.ts", "edited");
    let entered = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));
    let (current, jobs) = thread::scope(|scope| {
        let seed = scope.spawn(|| {
            startup.seed_with(|| {
                entered.wait();
                release.wait();
                render_calculation::facts(&fixture.inputs())
            })
        });
        entered.wait();
        let current = edited.reuse(Some(&startup));
        release.wait();
        seed.join().unwrap();
        current
    });
    assert_eq!(jobs, 4, "an unfinished seed must not block or supply facts");
    let expected = RenderKeys::build(&edited.inputs(), fallback());
    assert_eq!(current.modules, expected.modules);
    let (_, jobs) = edited.reuse(Some(&current));
    assert_eq!(jobs, 0, "the full edit supplied its own completed facts");
}

#[test]
fn failed_seed_is_unavailable_once_and_keeps_exact_full_fallback() {
    for panic in [false, true] {
        let fixture = Fixture::new();
        let (startup, _) = fixture.unseeded();
        let result = catch_unwind(AssertUnwindSafe(|| {
            startup.seed_with(|| {
                assert!(!panic, "seed failed");
                Err(serde_json::from_str::<String>("{}").unwrap_err())
            })
        }));
        assert_eq!(result.is_err(), panic);
        startup.seed_with(|| panic!("a failed seed cannot be retried"));
        let (current, jobs) = fixture.reuse(Some(&startup));
        assert_eq!(jobs, 4);
        let expected = RenderKeys::build(&fixture.inputs(), fallback());
        assert_eq!(current.modules, expected.modules);
    }
}
