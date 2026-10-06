//! Pure ordered availability policy for explicit remote execution.

/// One condition or diagnostic in the required decision order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Check {
    /// Reject hosted workflow execution.
    GithubActions,
    /// Find one executable without running it.
    Program(&'static str),
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
pub(super) fn ordered_checks() -> [Check; 9] {
    [
        Check::GithubActions,
        Check::Program("blacksmith"),
        Check::Program("rsync"),
        Check::Program("ssh"),
        Check::Version,
        Check::Login,
        Check::Access,
        Check::Published,
        Check::Interrupt,
    ]
}

#[cfg(test)]
#[path = "_tests_/policy_tests.rs"]
mod policy_tests;
