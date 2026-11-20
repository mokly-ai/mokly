//! Query-only cloud build eligibility and durable scheduling policy.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_domain::pull_request::PullRequestRepositories;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::github_refs::{Branch, PullRequest};
use mkc_store_interface::store::Queries;

use crate::build_eligibility::{BuildAccess, BuildEligibility};
use crate::error::{ErrorResultExt, Result};

/// Last reconciled reference; pull requests retain the repository fork identity.
#[derive(Clone, Debug)]
pub enum BuildReference {
    /// Current branch tip, including deletion observations.
    Branch(Branch),
    /// Current pull request and its repository identities.
    PullRequest(PullRequest),
}

/// Deterministic scheduling inputs generated before a retryable transaction.
#[derive(Clone, Debug)]
pub struct BuildSchedule {
    /// Fresh UUID v7 for the queued build.
    pub id: BuildId,
    /// Project that must still be eligible in the transaction.
    pub project_id: ProjectId,
    /// Trigger owning this scheduling effect.
    pub trigger: BuildTrigger,
    /// Reconciled reference, never webhook payload identity.
    pub reference: BuildReference,
    /// Captured scheduling time.
    pub at: DateTime<Utc>,
    /// Original comparison base for rerun; ignored by all other triggers.
    pub rerun_base_ref: Option<String>,
}

/// Scheduling callback; callers own the durable-effect transaction.
#[unimock::unimock(api = BuildSchedulerMock)]
pub trait BuildScheduler: Send + Sync {
    /// Recheck eligibility and duplicates, then schedule with atomic supersession.
    fn schedule(&self, queries: &mut dyn Queries, input: &BuildSchedule)
    -> Result<Option<BuildId>>;
}

/// Deployment availability is fixed at composition time.
pub struct DatabaseBuildScheduler {
    /// A complete builds and GitHub configuration is present.
    pub configured: bool,
}

impl BuildEligibility for DatabaseBuildScheduler {
    fn configured(&self) -> bool {
        self.configured
    }
}

impl BuildScheduler for DatabaseBuildScheduler {
    fn schedule(
        &self,
        queries: &mut dyn Queries,
        input: &BuildSchedule,
    ) -> Result<Option<BuildId>> {
        if !self.configured {
            return Ok(None);
        }
        let Some(access) = self.access(queries, input.project_id)? else {
            return Ok(None);
        };
        if !self.publishing_allowed(queries, &access.project)? {
            return Ok(None);
        }
        if matches!(
            input.trigger,
            BuildTrigger::Push | BuildTrigger::PullRequest | BuildTrigger::Setup
        ) && !access.project.automatic_builds
        {
            return Ok(None);
        }
        let Some(build) = scheduled_value(input, &access) else {
            return Ok(None);
        };
        if queries
            .publication_by_identity(build.project_id, &build.head_sha, &build.config_path)
            .context("check build publication duplicate")?
            .is_some()
            || queries
                .active_build(build.project_id, &build.head_sha)
                .context("check active build duplicate")?
                .is_some()
        {
            return Ok(None);
        }
        queries
            .schedule_build(&build)
            .context("schedule durable build and checks")?;
        Ok(Some(build.id))
    }
}

fn scheduled_value(input: &BuildSchedule, access: &BuildAccess) -> Option<NewBuild> {
    let (branch, head, pull, base) = match &input.reference {
        BuildReference::Branch(reference) => {
            if reference.repository_id != access.repository.id
                || matches!(input.trigger, BuildTrigger::PullRequest)
                || matches!(input.trigger, BuildTrigger::Push | BuildTrigger::Setup)
                    && reference.name != access.repository.default_branch
            {
                return None;
            }
            let base = (reference.name != access.repository.default_branch)
                .then(|| access.repository.default_branch.clone());
            (
                reference.name.clone(),
                reference.head_sha.clone()?,
                None,
                base,
            )
        }
        BuildReference::PullRequest(reference) => {
            if reference.repository_id != access.repository.id
                || !reference.open
                || (PullRequestRepositories {
                    bound: access.repository.github_id,
                    head: reference.head_repository_id,
                    base: reference.base_repository_id,
                })
                .is_fork()
                || matches!(input.trigger, BuildTrigger::Push | BuildTrigger::Setup)
            {
                return None;
            }
            (
                reference.head_ref.clone(),
                reference.head_sha.clone(),
                Some(reference.number),
                Some(reference.base_ref.clone()),
            )
        }
    };
    Some(NewBuild {
        id: input.id,
        project_id: input.project_id,
        repository_id: access.repository.id,
        trigger: input.trigger,
        branch,
        head_sha: head,
        pull_request: pull,
        base_ref: if input.trigger == BuildTrigger::Rerun {
            input.rerun_base_ref.clone()
        } else {
            base
        },
        config_path: access.project.config_path.clone(),
        created_at: input.at,
    })
}
