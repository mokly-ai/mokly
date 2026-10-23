//! Cancelling a capture does not poison the retained base for a later retry.

use std::sync::Arc;

use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::changes_signal::{ChangeSignal, ChangeSignalMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_cancel::{CaptureCancellation, CaptureScopes};

#[test]
fn each_capture_has_an_independent_cancellation_scope() {
    let scopes: &dyn CaptureScopes = &CaptureCancellation::default();
    let failed: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    {
        let _lease = scopes.enter(failed.clone());
        assert!(!scopes.cancelled());
        failed.cancel();
        assert!(scopes.cancelled());
    }
    assert!(!scopes.cancelled());
    {
        let retry: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        let _lease = scopes.enter(retry.clone());
        assert!(!scopes.cancelled());
        scopes.cancel();
        assert!(retry.cancelled());
    }
    assert!(!scopes.cancelled());
}

#[test]
fn admission_listeners_follow_capture_retries_and_late_registration() {
    let scopes: &dyn CaptureScopes = &CaptureCancellation::default();
    let signal: Arc<dyn ChangeSignal> = Arc::new(Unimock::new(
        ChangeSignalMock::notify
            .each_call(matching!())
            .returns(())
            .n_times(2),
    ));
    scopes.observe(Arc::downgrade(&signal));
    scopes.observe(Arc::downgrade(&signal));
    for _ in 0..2 {
        let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        let _lease = scopes.enter(token.clone());
        scopes.cancel();
        assert!(token.cancelled());
    }
    let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let _lease = scopes.enter(token.clone());
    let late: Arc<dyn ChangeSignal> = Arc::new(Unimock::new(
        ChangeSignalMock::notify.next_call(matching!()).returns(()),
    ));
    scopes.observe(Arc::downgrade(&late));
    assert!(!token.cancelled());
    drop(signal);
    token.cancel();
}
