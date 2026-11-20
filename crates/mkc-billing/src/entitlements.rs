//! Organization-plan reads and derived project entitlements.

use mkc_domain::ids::OrganizationId;
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::store::Queries;

use crate::error::{Error, ErrorResultExt, Feature, Result};

/// Plan behavior evaluated within the caller's transaction.
#[unimock::unimock(api = EntitlementsMock)]
pub trait Entitlements: Send + Sync {
    /// Read the organization's persisted plan.
    fn plan(&self, queries: &mut dyn Queries, organization: OrganizationId) -> Result<Plan>;
    /// Derive the default visibility for a newly created project.
    fn default_visibility(
        &self,
        queries: &mut dyn Queries,
        organization: OrganizationId,
    ) -> Result<Visibility>;
    /// Require the plan that permits private projects.
    fn require_private_projects(
        &self,
        queries: &mut dyn Queries,
        organization: OrganizationId,
    ) -> Result<()>;
}

/// Database-backed entitlement policy with no state outside the transaction.
pub struct DatabaseEntitlements;

impl Entitlements for DatabaseEntitlements {
    fn plan(&self, queries: &mut dyn Queries, organization: OrganizationId) -> Result<Plan> {
        Ok(queries
            .organization(organization)
            .context("read organization plan")?
            .ok_or(Error::NotFound)?
            .plan)
    }

    fn default_visibility(
        &self,
        queries: &mut dyn Queries,
        organization: OrganizationId,
    ) -> Result<Visibility> {
        Ok(
            if self.plan(queries, organization)?.allows_private_projects() {
                Visibility::Private
            } else {
                Visibility::Public
            },
        )
    }

    fn require_private_projects(
        &self,
        queries: &mut dyn Queries,
        organization: OrganizationId,
    ) -> Result<()> {
        if self.plan(queries, organization)?.allows_private_projects() {
            Ok(())
        } else {
            Err(Error::PlanRequired {
                required: Plan::Team,
                feature: Feature::PrivateProjects,
            })
        }
    }
}
