//! Release retention, fixed seeding, byte eviction, and stop clearing.

use crate::pool::SidecarPool;

use super::recipe_support::{Fixture, envelope_size};

#[test]
fn seed_restores_the_highest_live_epoch_on_each_fresh_worker() {
    let fixture = Fixture::new(usize::MAX);
    fixture.select(0);
    fixture.bundle("entry.ts", "a-old");
    fixture.select(0);
    fixture.bundle("entry.ts", "z-new");
    for slot in 1..4 {
        assert_eq!(fixture.probe("entry.ts", "probe", slot), ["z-new"]);
    }
}

#[test]
fn the_bound_evicts_the_least_recently_seeded_recipe() {
    let fixture = Fixture::new(2 * envelope_size("a.ts", "a0"));
    fixture.release("a.ts", "a0");
    fixture.release("b.ts", "b0");
    assert_eq!(fixture.probe("a.ts", "probe-a", 0), ["a0"]);
    fixture.release("c.ts", "c0");
    assert_eq!(fixture.probe("a.ts", "probe-a", 0), ["a0"]);
    assert_eq!(fixture.probe("b.ts", "probe-b", 0), Vec::<String>::new());
    assert_eq!(fixture.probe("c.ts", "probe-c", 0), ["c0"]);
}

#[test]
fn the_last_release_replaces_equal_settings_and_reuse_makes_the_recipe_live() {
    let fixture = Fixture::new(usize::MAX);
    fixture.release("entry.ts", "a0");
    fixture.release("entry.ts", "a1");
    assert_eq!(fixture.retained(), 1);
    assert_eq!(fixture.probe("entry.ts", "probe", 0), ["a1"]);
    let reused = fixture.bundle("entry.ts", "a1");
    assert_eq!(fixture.retained(), 0);
    fixture
        .pool
        .release_generation(&reused.generation, reused.epoch);
    fixture.pool.synchronize_releases();
    assert_eq!(fixture.retained(), 1);
}

#[test]
fn the_serialized_envelope_fits_exactly_and_an_oversized_recipe_is_not_retained() {
    let fixture = Fixture::new(envelope_size("a.ts", "a0"));
    fixture.release("a.ts", "a0");
    assert_eq!(fixture.probe("a.ts", "probe-a", 0), ["a0"]);
    fixture.release("larger-entry.ts", "b0");
    assert_eq!(
        fixture.probe("larger-entry.ts", "probe-b", 0),
        Vec::<String>::new()
    );
    assert_eq!(fixture.probe("a.ts", "probe-a", 0), ["a0"]);
}

#[test]
fn every_pool_stop_clears_retained_recipes_and_late_releases_keep_it_empty() {
    for stop in [
        SidecarPool::shutdown,
        SidecarPool::abort,
        SidecarPool::cancel_requests,
    ] {
        let fixture = Fixture::new(usize::MAX);
        fixture.release("entry.ts", "a0");
        let live = fixture.bundle("other.ts", "b0");
        assert_eq!(fixture.retained(), 1);
        stop(&fixture.pool).unwrap();
        assert_eq!(fixture.retained(), 0);
        fixture
            .pool
            .release_generation(&live.generation, live.epoch);
        assert_eq!(fixture.retained(), 0);
    }
}
