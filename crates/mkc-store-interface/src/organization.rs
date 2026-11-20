//! Organization persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_domain::slug::WorkspaceSlug;
use mkc_domain::values::Plan;

use crate::error::Result;

/// Persisted organization data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct Organization {
    /// Stored id.
    pub id: OrganizationId,
    /// Stored name.
    pub name: String,
    /// Current readable address.
    pub slug: WorkspaceSlug,
    /// Stored version.
    pub version: i64,
    /// Stored created at.
    pub created_at: DateTime<Utc>,
    /// Stored billing plan.
    pub plan: Plan,
}

/// Distinct active users grouped by their strongest billable role.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SeatCounts {
    /// Users occupying Editor seats.
    pub editors: i64,
    /// Users occupying Collaborator seats.
    pub collaborators: i64,
}

/// Organization resolved through a current or historical slug claim.
#[derive(Clone, Debug)]
pub struct OrganizationLookup {
    /// Resolved organization record.
    pub value: Organization,
    /// Whether the requested slug differs from the current slug.
    pub retired: bool,
}

/// Queries for organizations within the caller's transaction.
#[unimock::unimock(api = OrganizationsMock)]
pub trait Organizations {
    /// Execute the organization query.
    fn organization(&mut self, id: OrganizationId) -> Result<Option<Organization>>;
    /// Resolve a current or historical organization slug.
    fn find_organization_by_slug(
        &mut self,
        slug: &WorkspaceSlug,
    ) -> Result<Option<OrganizationLookup>>;
    /// Whether any live organization owns this current or historical claim.
    fn organization_slug_claimed(&mut self, slug: &WorkspaceSlug) -> Result<bool>;
    /// Execute the insert organization query.
    fn insert_organization(&mut self, value: &Organization) -> Result<()>;
    /// Execute the save organization query.
    fn save_organization(&mut self, value: &Organization) -> Result<()>;
    /// Execute the delete organization query.
    fn delete_organization(&mut self, id: OrganizationId) -> Result<()>;
    /// Count distinct billable users by their strongest organization role.
    fn seat_counts(&mut self, organization: OrganizationId) -> Result<SeatCounts>;
}
