//! An unkept startup capture follows its accepting reader without reattaching kept bases.

use std::sync::Arc;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_server::changes::{ChangeCancellation, ChangeToken};

use crate::serve_base_cancel::{BaseLifetime, PreparingBase};
use crate::serve_capture_cancel::CaptureCancellation;
use crate::serve_changes_base::CombinedCancel;

#[test]
fn startup_handoff_moves_only_the_unkept_base_to_the_accepting_reader_lifetime() {
    let command = Arc::new(ServeCancellation::default());
    let startup = Arc::new(ChangeToken::default());
    let ordinary = Arc::new(ChangeToken::default());
    let cancellation = |generation: Arc<ChangeToken>| {
        Arc::new(CombinedCancel {
            command: command.clone(),
            generation,
            operation: Arc::new(CaptureCancellation::default()),
        })
    };
    let unkept: &dyn BaseLifetime = &PreparingBase::new(cancellation(startup.clone()));
    let retained: &dyn BaseLifetime = &PreparingBase::new(cancellation(startup.clone()));
    retained.detach();
    unkept.transfer(cancellation(ordinary.clone()));
    retained.transfer(cancellation(ordinary.clone()));
    startup.cancel();
    let after_startup = (unkept.requested(), retained.requested());
    ordinary.cancel();
    let after_reader = (unkept.requested(), retained.requested());
    command.interrupt();
    let after_command = (unkept.requested(), retained.requested());
    assert_eq!(after_startup, (false, false));
    assert_eq!(after_reader, (true, false));
    assert_eq!(after_command, (true, true));
}
