//! Ineligible bases keep selected-capture cancellation while eligible kept bases detach it.

use std::sync::Arc;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_server::changes::{ChangeCancellation, ChangeToken};

use crate::serve_base_cancel::{BaseLifetime, PreparingBase};
use crate::serve_capture_cancel::{CaptureCancellation, CaptureScopes};
use crate::serve_changes_base::CombinedCancel;
use crate::serve_eager_cancel::{OriginCancellation, OriginScope};

#[test]
fn eager_lifetime_uses_selected_capture_scope_until_an_eligible_keep_detaches() {
    let command = Arc::new(ServeCancellation::default());
    let origin: Arc<dyn OriginScope> = Arc::new(OriginCancellation::default());
    origin.reader(Arc::new(ChangeToken::default()));
    let operation = Arc::new(CaptureCancellation::default());
    origin.operation(operation.clone());
    let lifetime = PreparingBase::owned(
        Arc::new(CombinedCancel {
            command: command.clone(),
            generation: origin.clone(),
            operation: Arc::new(ChangeToken::default()),
        }),
        origin,
    );
    let initial = lifetime.requested();
    let selected = {
        let capture = Arc::new(ChangeToken::default());
        let _scope = operation.enter(capture.clone());
        capture.cancel();
        lifetime.requested()
    };
    let cleared = lifetime.requested();
    lifetime.detach();
    let kept = {
        let capture = Arc::new(ChangeToken::default());
        let _scope = operation.enter(capture.clone());
        capture.cancel();
        lifetime.requested()
    };
    assert_eq!(
        [initial, selected, cleared, kept],
        [false, true, false, false]
    );
    assert!(!command.requested());
}
