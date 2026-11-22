//! Each seed that a short reply can name stays resolvable until its bundle request ends.

use super::origin_support::{Finish, Observation, Seed, exercise};

fn assert_pinned(result: Observation) {
    assert_eq!(
        result.during,
        (1, 1),
        "only the active pool attempt owns the named seed"
    );
    assert_eq!(
        result.returned,
        (2, 2),
        "only State and the result own the recipe after return"
    );
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Ok(generation) if generation == "result"));
}

#[test]
fn a_released_recipe_seed_stays_pinned_when_its_recipe_is_evicted() {
    assert_pinned(exercise(Finish::Success, Seed::Released));
}

#[test]
fn a_serve_edit_fallback_seed_stays_pinned_across_its_final_release() {
    assert_pinned(exercise(Finish::Success, Seed::Fallback));
}

#[test]
fn a_disk_seed_is_owned_by_its_attempt_until_the_request_ends() {
    assert_pinned(exercise(Finish::Success, Seed::Disk));
}
