//! RateLimit persistence data and query boundary.

use chrono::{DateTime, Utc};

use crate::error::Result;

/// Persisted rate limit data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct RateLimit {
    /// Stored key.
    pub key: String,
    /// Stored count.
    pub count: i64,
    /// Stored resets at.
    pub resets_at: DateTime<Utc>,
}

/// Queries for auth rate limits within the caller's transaction.
#[unimock::unimock(api = RateLimitsMock)]
pub trait RateLimits {
    /// Remove admission windows reset at or before the retained cutoff.
    fn prune_rate_limits(&mut self, before: DateTime<Utc>) -> Result<usize>;
    /// Execute the rate limit query.
    fn rate_limit(&mut self, key: &str) -> Result<Option<RateLimit>>;
    /// Execute the insert rate limit query.
    fn insert_rate_limit(&mut self, value: &RateLimit) -> Result<()>;
    /// Execute the save rate limit query.
    fn save_rate_limit(&mut self, value: &RateLimit) -> Result<()>;
}
