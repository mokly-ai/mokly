//! Stable command termination and error-chain wording.

use crate::error;
use crate::remote::error::{Error, Operation};

#[test]
fn command_failures_name_exit_codes_and_signals() {
    for (code, wording) in [(Some(1), "exit 1"), (None, "a signal")] {
        let source = Error::Command {
            operation: Operation::Blacksmith,
            code,
        };
        assert!(source.to_string().ends_with(wording));
        let wrapped = error::Error::Remote { source }.to_string();
        assert!(wrapped.starts_with("[xtask/check] [xtask/remote]"));
    }
}
