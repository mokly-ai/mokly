//! Cancelling a capture does not poison the retained base for a later retry.

use std::sync::Arc;

use mokly_server::changes::{ChangeCancellation, ChangeToken};

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
