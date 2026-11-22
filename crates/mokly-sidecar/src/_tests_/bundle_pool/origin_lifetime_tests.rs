//! Bundle pins survive final release without a client-owned recipe cache.

use crate::error::{Error, RemoteCode, RequestCode};

use super::origin_support::{Finish, Seed, exercise};

#[test]
fn a_busy_bundle_pins_a_live_restore_across_final_release_and_recipe_eviction() {
    let result = exercise(Finish::Success, Seed::Live);
    assert_eq!(
        result.during,
        (1, 1),
        "only the active pool attempt pins this recipe"
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
fn an_already_loaded_restore_stays_pinned_during_a_concurrent_final_release() {
    let result = exercise(Finish::Success, Seed::Loaded);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (2, 2));
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Ok(generation) if generation == "result"));
}

#[test]
fn a_failed_bundle_drops_request_pins_before_return() {
    let result = exercise(Finish::Failure, Seed::Live);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (0, 0));
    assert_eq!(result.released, (0, 0));
    assert!(
        matches!(result.result, Err(Error::Remote { code: RemoteCode::Request(RequestCode::BundleFailed), message }) if message == "source failed")
    );
}

#[test]
fn stopping_a_busy_bundle_drops_request_pins_before_return() {
    let result = exercise(Finish::Stop, Seed::Live);
    assert_eq!(result.during, (1, 1));
    assert_eq!(result.returned, (0, 0));
    assert_eq!(result.released, (0, 0));
    assert!(matches!(result.result, Err(Error::Cancelled)));
}
