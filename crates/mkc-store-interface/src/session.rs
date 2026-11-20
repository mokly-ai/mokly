//! Session persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::UserId;

use crate::auth_prune::PruneBatch;
use crate::error::Result;

/// Persisted session data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Session {
    /// Stored token hash.
    pub token_hash: String,
    /// Stored user id.
    pub user_id: UserId,
    /// Stored csrf token.
    pub csrf_token: String,
    /// Stored created at.
    pub created_at: DateTime<Utc>,
    /// Stored expires at.
    pub expires_at: DateTime<Utc>,
    /// Stored last seen at.
    pub last_seen_at: DateTime<Utc>,
}

/// Queries for sessions within the caller's transaction.
#[unimock::unimock(api = SessionsMock)]
pub trait Sessions {
    /// Remove one bounded batch past the absolute or activity retention cutoff.
    fn prune_sessions(
        &mut self,
        expires_before: DateTime<Utc>,
        seen_before: DateTime<Utc>,
        batch: PruneBatch,
    ) -> Result<usize>;
    /// Update activity only for rows older than the supplied threshold. The
    /// statement rechecks the threshold itself, so concurrent touches are
    /// harmless and the call needs no transaction.
    fn touch(&mut self, hash: &str, now: DateTime<Utc>, before: DateTime<Utc>) -> Result<()>;
    /// Execute the session query.
    fn session(&mut self, token_hash: &str) -> Result<Option<Session>>;
    /// Execute the insert session query.
    fn insert_session(&mut self, value: &Session) -> Result<()>;
    /// Execute the delete session query.
    fn delete_session(&mut self, token_hash: &str) -> Result<()>;
}
