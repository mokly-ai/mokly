//! Installation reference reads precede one serializable scheduling transaction.

use mkc_domain::ids::{ProjectId, UserId};
use mkc_domain::pull_request::PullRequestRepositories;
use mkc_domain::values::Plan;
use mkc_publications::build_eligibility::{BuildAccess, BuildEligibility};
use mkc_publications::build_scheduler::{BuildReference, BuildSchedule};
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::store::Queries;

use crate::build_error::BuildError;
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::error_data::{
    ActiveBuild, BuildIneligible, IneligibleCause, PlanRequired, PublishedBuild,
};

use super::input::{Branch as BranchInput, Reference};
use super::projection;
use super::reads::{authorize, write_role};
use super::service::BuildsService;
use super::views;

impl BuildsService {
    fn eligible(&self, queries: &mut dyn Queries, project: ProjectId) -> Result<BuildAccess> {
        let access = self
            .access(queries, project)
            .context("check build availability")?
            .ok_or(ApiError::Build(BuildError::Unavailable))?;
        if !self
            .publishing_allowed(queries, &access.project)
            .context("check build publishing plan")?
        {
            return Err(ApiError::PlanRequired(PlanRequired {
                required_plan: Plan::Team,
                feature: "private-projects".to_owned(),
            }));
        }
        Ok(access)
    }

    pub(super) fn request(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        reference: Reference,
    ) -> Result<views::Build> {
        let mut access = None;
        self.transact(true, &mut |queries| {
            authorize(write_role(queries, actor, project)?)?;
            access = Some(self.eligible(queries, project)?);
            Ok(())
        })?;
        let access = access.ok_or(ApiError::NotFound)?;
        let reference = self.reference(&access, &reference)?;
        let input = BuildSchedule {
            id: self.runtime.id().into(),
            project_id: project,
            trigger: BuildTrigger::Request,
            reference,
            at: self.runtime.now(),
            rerun_base_ref: None,
        };
        let mut result = None;
        let mut refusal = None;
        self.transact(false, &mut |queries| {
            result = None;
            refusal = None;
            let role = write_role(queries, actor, project)?;
            authorize(role)?;
            let current = self.eligible(queries, project)?;
            if current.repository.id != access.repository.id
                || current.installation.id != access.installation.id
            {
                return Err(ApiError::Build(BuildError::Unavailable));
            }
            let mut input = input.clone();
            input.reference = self
                .head_recorder
                .record(queries, &input.reference)
                .context("record requested build head")?
                .ok_or(ApiError::NotFound)?;
            let head = match &input.reference {
                BuildReference::Branch(value) => {
                    value.head_sha.as_deref().ok_or(ApiError::NotFound)?
                }
                BuildReference::PullRequest(value) => {
                    let cause = if !value.open || value.merged {
                        Some(IneligibleCause::ClosedPullRequest)
                    } else if (PullRequestRepositories {
                        bound: current.repository.github_id,
                        head: value.head_repository_id,
                        base: value.base_repository_id,
                    })
                    .is_fork()
                    {
                        Some(IneligibleCause::ForkPullRequest)
                    } else {
                        None
                    };
                    if let Some(cause) = cause {
                        refusal = Some(ApiError::Build(BuildError::Ineligible(BuildIneligible {
                            cause,
                        })));
                        return Ok(());
                    }
                    &value.head_sha
                }
            };
            if let Some(publication) = queries
                .publication_by_identity(project, head, &current.project.config_path)
                .context("check requested publication")?
            {
                refusal = Some(ApiError::Build(BuildError::AlreadyPublished(
                    PublishedBuild {
                        publication_id: publication.id,
                    },
                )));
                return Ok(());
            }
            if let Some(build) = queries
                .active_build(project, head)
                .context("check requested active build")?
            {
                refusal = Some(ApiError::Build(BuildError::AlreadyActive(ActiveBuild {
                    build_id: build.id,
                })));
                return Ok(());
            }
            let id = self
                .scheduler
                .schedule(queries, &input)
                .context("schedule requested build")?
                .ok_or(ApiError::Build(BuildError::Unavailable))?;
            let row = queries
                .viewer_build(project, id)
                .context("read scheduled build")?
                .ok_or(ApiError::NotFound)?;
            result = Some(projection::build(row, Some(role)));
            Ok(())
        })?;
        if let Some(error) = refusal {
            return Err(error);
        }
        result.ok_or(ApiError::NotFound)
    }

    pub(super) fn schedule_setup(&self, project: ProjectId) -> Result<()> {
        let mut access = None;
        self.transact(true, &mut |queries| {
            let candidate = self
                .access(queries, project)
                .context("read setup availability")?;
            if let Some(candidate) = candidate
                && candidate.project.automatic_builds
                && self
                    .publishing_allowed(queries, &candidate.project)
                    .context("check setup publishing plan")?
            {
                access = Some(candidate);
            }
            Ok(())
        })?;
        let Some(access) = access else { return Ok(()) };
        let reference = self.reference(
            &access,
            &Reference::Branch(BranchInput {
                branch: access.repository.default_branch.clone(),
            }),
        )?;
        let input = BuildSchedule {
            id: self.runtime.id().into(),
            project_id: project,
            trigger: BuildTrigger::Setup,
            reference,
            at: self.runtime.now(),
            rerun_base_ref: None,
        };
        self.transact(false, &mut |queries| {
            let mut current = input.clone();
            let Some(stored) = self
                .head_recorder
                .record(queries, &input.reference)
                .context("record setup build head")?
            else {
                return Ok(());
            };
            current.reference = stored;
            self.scheduler
                .schedule(queries, &current)
                .context("schedule project setup build")?;
            Ok(())
        })
    }
}
