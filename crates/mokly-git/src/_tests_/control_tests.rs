//! Fake-time shutdown boundaries and cancellation state.

use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::control::{Cancellation, Clock, ClockMock, Shutdown, Signal, Token};

#[test]
fn shutdown_terminates_once_and_kills_at_one_second() {
    let clock: &dyn Clock = &Unimock::new((
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(10)),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(1009)),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(1010)),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_secs(5)),
    ));
    let mut shutdown = Shutdown::default();
    assert_eq!(shutdown.step(Duration::ZERO, false), None);
    assert_eq!(shutdown.step(clock.now(), true), Some(Signal::Terminate));
    assert_eq!(shutdown.step(clock.now(), true), None);
    assert_eq!(shutdown.step(clock.now(), false), Some(Signal::Kill));
    assert_eq!(shutdown.step(clock.now(), true), None);
}

#[test]
fn cancellation_is_sticky() {
    let token = Token::default();
    assert!(!token.cancelled());
    token.cancel();
    assert!(token.cancelled());
    token.cancel();
    assert!(token.cancelled());
}
