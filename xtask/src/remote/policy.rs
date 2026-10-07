//! Pure ordered availability policy for explicit remote execution.

use crate::executor::{Executor, LocalReason};

/// One condition or diagnostic in the required decision order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Check {
    /// Reject hosted workflow execution.
    GithubActions,
    /// Require an org key before any automatic program lookup.
    Key,
    /// Find all required executables without running them.
    Programs,
    /// Print the CLI version after finding every required executable.
    Version,
    /// Log in only when an org key is supplied.
    Login,
    /// Verify access through the box list.
    Access,
    /// Require an origin ref that contains HEAD.
    Published,
    /// Reject a pending interrupt before any warmup.
    Interrupt,
}

/// Required order; an absent key lets explicit remote continue at Login.
pub(super) fn ordered_checks(mode: Executor) -> Vec<Check> {
    if mode == Executor::Local {
        return Vec::new();
    }
    let mut checks = vec![Check::GithubActions];
    if mode == Executor::Auto {
        checks.push(Check::Key);
    }
    checks.extend([
        Check::Programs,
        Check::Version,
        Check::Login,
        Check::Access,
        Check::Published,
        Check::Interrupt,
    ]);
    checks
}

impl Check {
    /// Name the failed availability row without reading error text.
    pub(super) fn local_reason(self) -> LocalReason {
        match self {
            Self::GithubActions => LocalReason::GithubActions,
            Self::Key => LocalReason::NoKey,
            Self::Programs => LocalReason::Program,
            Self::Version => LocalReason::Version,
            Self::Login => LocalReason::Login,
            Self::Access => LocalReason::Access,
            Self::Published | Self::Interrupt => LocalReason::Published,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/policy_tests.rs"]
mod policy_tests;
