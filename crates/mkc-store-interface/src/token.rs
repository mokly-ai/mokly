//! Token persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{ProjectId, TokenId};

use crate::error::Result;

/// Persisted token data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Token {
    /// Stored id.
    pub id: TokenId,
    /// Stored project id.
    pub project_id: ProjectId,
    /// Stored name.
    pub name: String,
    /// Stored prefix.
    pub prefix: String,
    /// Stored token hash.
    pub token_hash: String,
    /// Stored created at.
    pub created_at: DateTime<Utc>,
    /// Stored last used at.
    pub last_used_at: Option<DateTime<Utc>>,
    /// Stored revoked at.
    pub revoked_at: Option<DateTime<Utc>>,
}

/// Queries for project tokens within the caller's transaction.
#[unimock::unimock(api = TokensMock)]
pub trait Tokens {
    /// Find a bearer digest across projects without disclosing raw credentials.
    fn token_by_hash(&mut self, digest: &str) -> Result<Option<Token>>;
    /// Execute the token query.
    fn token(&mut self, id: TokenId) -> Result<Option<Token>>;
    /// Execute the insert token query.
    fn insert_token(&mut self, value: &Token) -> Result<()>;
    /// Execute the save token query.
    fn save_token(&mut self, value: &Token) -> Result<()>;
    /// Execute the tokens query.
    fn tokens(&mut self, project: ProjectId) -> Result<Vec<Token>>;
}
