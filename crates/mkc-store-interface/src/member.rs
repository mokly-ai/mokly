//! Member persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{MemberId, OrganizationId, UserId};
use mkc_domain::values::Role;

use crate::error::Result;

/// Persisted member data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Member {
    /// Stored id.
    pub id: MemberId,
    /// Stored organization id.
    pub organization_id: OrganizationId,
    /// Stored user id.
    pub user_id: Option<UserId>,
    /// Stored email.
    pub email: String,
    /// Stored role.
    pub role: Role,
    /// Stored version.
    pub version: i64,
    /// Stored expires at.
    pub expires_at: Option<DateTime<Utc>>,
}

/// Queries for memberships within the caller's transaction.
#[unimock::unimock(api = MembersMock)]
pub trait Members {
    /// Execute the member query.
    fn member(&mut self, id: MemberId) -> Result<Option<Member>>;
    /// Execute the insert member query.
    fn insert_member(&mut self, value: &Member) -> Result<()>;
    /// Execute the save member query.
    fn save_member(&mut self, value: &Member) -> Result<()>;
    /// Execute the delete member query.
    fn delete_member(&mut self, id: MemberId) -> Result<()>;
    /// Execute the members query.
    fn members(&mut self, organization: OrganizationId) -> Result<Vec<Member>>;
    /// Execute the user memberships query.
    fn user_memberships(&mut self, user: UserId) -> Result<Vec<Member>>;
}
