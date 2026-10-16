//! Vanished paths skip attachment; resource exhaustion remains a reported error.

use std::io;

use super::vanished;

#[test]
fn watch_not_found_races_do_not_turn_into_candidate_failures() {
    assert!(vanished(&notify::Error::path_not_found()));
    for kind in [io::ErrorKind::NotFound, io::ErrorKind::NotADirectory] {
        assert!(vanished(&notify::Error::io(io::Error::from(kind))));
    }
    assert!(!vanished(&notify::Error::io(io::Error::from(
        io::ErrorKind::PermissionDenied
    ))));
    assert!(!vanished(&notify::Error::generic("watch limit reached")));
}
