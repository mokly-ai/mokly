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

#[test]
fn executor_selection_errors_keep_the_remote_module_prefix() {
    for error in [
        Error::InvalidExecutor {
            value: "invalid".into(),
        },
        Error::SelectedSuite,
        Error::GithubActions,
        Error::MissingProgram {
            program: "ssh",
            hint: "install ssh",
        },
        Error::UnpublishedHead,
        Error::Captured {
            source: Box::new(Error::Worker),
            output: Default::default(),
        },
    ] {
        assert!(error.to_string().starts_with("[xtask/remote] "), "{error}");
    }
}

#[test]
fn wrapped_remote_errors_do_not_repeat_their_module_prefix() {
    let error = Error::PreparationCleanup {
        source: Box::new(Error::Command {
            operation: Operation::Blacksmith,
            code: Some(1),
        }),
        failures: 1,
    };
    assert_eq!(error.to_string().matches("[xtask/remote]").count(), 1);
}
