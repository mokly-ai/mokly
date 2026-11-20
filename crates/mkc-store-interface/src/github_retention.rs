//! Bounded deletion queries for expired GitHub authentication and delivery data.

use chrono::{DateTime, Utc};

use crate::error::Result;

/// GitHub records whose retention policy is independent of queue processing.
#[unimock::unimock(api = GitHubRetentionMock)]
pub trait GitHubRetention {
    /// Delete up to `limit` OAuth flows expired at or before the cutoff.
    fn prune_github_oauth_flows(&mut self, before: DateTime<Utc>, limit: i64) -> Result<usize>;

    /// Delete up to `limit` terminal deliveries received at or before the cutoff.
    fn prune_github_deliveries(&mut self, before: DateTime<Utc>, limit: i64) -> Result<usize>;
}
