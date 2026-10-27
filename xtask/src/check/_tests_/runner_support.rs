//! Mocked in-process auditors for the check runner tests.

use std::sync::Arc;

use unimock::Unimock;

use super::commands::Step;
use super::runner::Auditors;

/// Auditors that each test configures; an unused one has no expectations.
pub(super) fn auditors(
    rust_file_length: Unimock,
    source_file_length: Unimock,
    protocol_caps: Unimock,
) -> Auditors {
    Auditors {
        rust_file_length: Arc::new(rust_file_length),
        source_file_length: Arc::new(source_file_length),
        protocol_caps: Arc::new(protocol_caps),
    }
}

/// Auditors that the test never calls.
pub(super) fn unused_auditors() -> Auditors {
    auditors(Unimock::new(()), Unimock::new(()), Unimock::new(()))
}

/// The command line of a subprocess step, or the name of an in-process one.
pub(super) fn step_display(step: &Step) -> String {
    match step {
        Step::Command(command) => command.display(),
        Step::SourceFileLength => "source and protocol file-length audit".to_owned(),
        Step::Ratchets(command) => format!("protocol cap ratchet, then {}", command.display()),
    }
}
