//! Publication authorization on the same query snapshot as each operation.

use mkc_domain::ids::{ProjectId, UserId};
use mkc_domain::values::Visibility;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;
use mkc_store_interface::token::Token;

use crate::error::{Error, ErrorResultExt, Result};

/// Authorization behavior evaluated inside query-only transactions.
#[unimock::unimock(api = AccessPolicyMock)]
pub trait AccessPolicy: Send + Sync {
    /// Recheck a bearer digest and its immutable project scope.
    fn token(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        digest: &str,
    ) -> Result<(Project, Token)>;
    /// Require public visibility or an active inherited/direct membership.
    fn read(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        actor: Option<UserId>,
    ) -> Result<Project>;
}

/// Platform role/visibility policy; no guessed GitHub authorization.
pub struct DatabaseAccessPolicy;

impl AccessPolicy for DatabaseAccessPolicy {
    fn token(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        digest: &str,
    ) -> Result<(Project, Token)> {
        let token = queries
            .token_by_hash(digest)
            .context("lookup publication bearer")?
            .ok_or(Error::Unauthorized)?;
        if token.revoked_at.is_some() {
            return Err(Error::Unauthorized);
        }
        if token.project_id != project {
            return Err(Error::Forbidden);
        }
        let project = queries
            .project(project)
            .context("read bearer project")?
            .ok_or(Error::Unauthorized)?;
        let organization = queries
            .organization(project.organization_id)
            .context("read publication organization plan")?
            .ok_or(Error::Unauthorized)?;
        if !organization.plan.allows_publication(project.visibility) {
            return Err(Error::PlanRequired);
        }
        Ok((project, token))
    }

    fn read(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        actor: Option<UserId>,
    ) -> Result<Project> {
        let project = queries
            .project(project)
            .context("read catalogue project visibility")?
            .ok_or(Error::NotFound)?;
        if project.visibility == Visibility::Public {
            return Ok(project);
        }
        let actor = actor.ok_or(Error::Unauthorized)?;
        if queries
            .user(actor)
            .context("read catalogue member identity")?
            .is_none()
        {
            return Err(Error::Unauthorized);
        }
        let inherited = queries
            .members(project.organization_id)
            .context("read catalogue organization membership")?
            .iter()
            .any(|member| member.user_id == Some(actor));
        let direct = queries
            .grants(project.id)
            .context("read catalogue direct grants")?
            .iter()
            .any(|grant| grant.user_id == actor);
        if !inherited && !direct {
            return Err(Error::NotFound);
        }
        Ok(project)
    }
}
