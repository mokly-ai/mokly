//! MagicLink persistence data and query boundary.

use chrono::{DateTime, Utc};

use crate::auth_prune::PruneBatch;
use crate::error::Result;

/// Persisted magic link data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct MagicLink {
    /// Stored token hash.
    pub token_hash: String,
    /// Stored email.
    pub email: String,
    /// Stored return to.
    pub return_to: String,
    /// Stored expires at.
    pub expires_at: DateTime<Utc>,
    /// Consumption time retained to distinguish replay from unknown credentials.
    pub used_at: Option<DateTime<Utc>>,
}

/// Queries for magic links within the caller's transaction.
#[unimock::unimock(api = MagicLinksMock)]
pub trait MagicLinks {
    /// Remove one bounded batch at or before the cutoff, including used links.
    fn prune_magic_links(&mut self, before: DateTime<Utc>, batch: PruneBatch) -> Result<usize>;
    /// Execute the magic link query.
    fn magic_link(&mut self, token_hash: &str) -> Result<Option<MagicLink>>;
    /// Execute the insert magic link query.
    fn insert_magic_link(&mut self, value: &MagicLink) -> Result<()>;
    /// Execute the save magic link query.
    fn save_magic_link(&mut self, value: &MagicLink) -> Result<()>;
}
