//! Signal state transitions preserve requests across either release ordering.

use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};

use crate::remote::contracts::Interrupt;

use super::{RELEASED, REQUESTED, SignalAction, SystemInterrupt, signal_request};

#[test]
fn request_before_release_remains_visible_and_the_next_signal_exits() {
    let (bits, action) = signal_request(0);
    assert_eq!((bits, action), (REQUESTED, SignalAction::Request));
    let interrupt = SystemInterrupt {
        state: Arc::new(AtomicU8::new(bits)),
    };
    assert!(interrupt.requested());
    interrupt.release();
    assert!(interrupt.requested());
    let released = interrupt.state.load(Ordering::SeqCst);
    assert_eq!(released, REQUESTED | RELEASED);
    assert_eq!(
        signal_request(released),
        (REQUESTED | RELEASED, SignalAction::Exit)
    );
}

#[test]
fn release_before_request_records_the_signal_and_exits() {
    let interrupt = SystemInterrupt::default();
    assert!(!interrupt.requested());
    interrupt.release();
    assert!(!interrupt.requested());
    let released = interrupt.state.load(Ordering::SeqCst);
    assert_eq!(released, RELEASED);
    let (bits, action) = signal_request(released);
    assert_eq!((bits, action), (REQUESTED | RELEASED, SignalAction::Exit));
    interrupt.state.store(bits, Ordering::SeqCst);
    assert!(interrupt.requested());
    interrupt.release();
    assert_eq!(interrupt.state.load(Ordering::SeqCst), bits);
}
