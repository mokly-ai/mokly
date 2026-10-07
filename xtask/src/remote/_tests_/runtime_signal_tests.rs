//! The installed handler must restore immediate exit after release.

use super::{SignalAction, signal_action};

#[test]
fn signal_requests_cleanup_before_release_and_exits_after_release() {
    assert_eq!(signal_action(false), SignalAction::Request);
    assert_eq!(signal_action(true), SignalAction::Exit);
}
