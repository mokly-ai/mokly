//! Grant persistence data and query boundary.

use mkc_domain::ids::{GrantId, ProjectId, UserId};
use mkc_domain::values::Role;

use crate::error::Result;

/// Persisted grant data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Grant {
    /// Stored id.
    pub id: GrantId,
    /// Stored project id.
    pub project_id: ProjectId,
    /// Stored user id.
    pub user_id: UserId,
    /// Stored role.
    pub role: Role,
    /// Stored version.
    pub version: i64,
}

/// Queries for project grants within the caller's transaction.
#[unimock::unimock(api = GrantsMock)]
pub trait Grants {
    /// Execute the grant query.
    fn grant(&mut self, id: GrantId) -> Result<Option<Grant>>;
    /// Execute the insert grant query.
    fn insert_grant(&mut self, value: &Grant) -> Result<()>;
    /// Execute the save grant query.
    fn save_grant(&mut self, value: &Grant) -> Result<()>;
    /// Execute the delete grant query.
    fn delete_grant(&mut self, id: GrantId) -> Result<()>;
    /// Execute the grants query.
    fn grants(&mut self, project: ProjectId) -> Result<Vec<Grant>>;
}
