//! Audit defaults, explicit mode commands, and suite compatibility.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock};

use crate::command::CommandRunnerRunMock;
use crate::error::Error;

use super::request::{CheckRequest, DependencyAudit, VerificationSuite};
use super::runner::{CheckRunner, DefaultCheckRunner};

#[test]
fn complete_and_repository_checks_propagate_default_and_explicit_audit_modes() {
    for suite in [None, Some(VerificationSuite::Repository)] {
        for (mode, expected) in [
            (None, "npm run dependencies:check -- --baseline"),
            (
                Some(DependencyAudit::Baseline),
                "npm run dependencies:check -- --baseline",
            ),
            (Some(DependencyAudit::Strict), "npm run dependencies:check"),
        ] {
            let command_runner = Arc::new(Unimock::new(
                CommandRunnerRunMock
                    .next_call(&|matching| {
                        matching.func(move |command, _| command.display() == expected);
                    })
                    .returns(Err(Error::CommandFailed {
                        command: expected.to_owned(),
                        status: "1".to_owned(),
                    })),
            ));
            let runner = DefaultCheckRunner::new(
                command_runner,
                Arc::new(Unimock::new(())),
                PathBuf::from("/workspace"),
            );
            let request = CheckRequest::new(suite, None, mode).expect("valid audit selection");

            assert!(matches!(
                runner.run(request),
                Err(Error::CommandFailed { command, .. }) if command == expected
            ));
        }
    }
}

#[test]
fn explicit_audit_modes_require_complete_or_repository_checks() {
    for suite in [
        VerificationSuite::Package,
        VerificationSuite::Unit,
        VerificationSuite::Browser,
        VerificationSuite::Hydration,
    ] {
        assert!(CheckRequest::new(Some(suite), None, None).is_ok());
        for mode in [DependencyAudit::Baseline, DependencyAudit::Strict] {
            let error = CheckRequest::new(Some(suite), None, Some(mode))
                .expect_err("explicit mode is incompatible with this suite");
            assert_eq!(
                error.to_string(),
                format!(
                    "[xtask/check] --dependency-audit is not supported with suite {suite}; select the complete gate or --suite repository"
                ),
            );
            assert!(matches!(
                error,
                Error::UnsupportedDependencyAudit { suite: rejected } if rejected == suite
            ));
        }
    }
}
