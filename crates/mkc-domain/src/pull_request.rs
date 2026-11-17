//! Shared fork identity for reference reads and build eligibility.

/// Retained GitHub repository identities for a project's pull request.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PullRequestRepositories {
    /// Numeric GitHub ID of the project's bound repository.
    pub bound: i64,
    /// Last observed head repository; absent when GitHub no longer reports it.
    pub head: Option<i64>,
    /// Last observed base repository; absent on older observations.
    pub base: Option<i64>,
}

impl PullRequestRepositories {
    /// Whether either repository is foreign or missing, regardless of PR state.
    pub fn is_fork(self) -> bool {
        self.head != Some(self.bound) || self.base != Some(self.bound)
    }
}

#[cfg(test)]
#[path = "_tests_/pull_request_tests.rs"]
mod tests;
