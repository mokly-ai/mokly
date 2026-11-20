//! Trait-backed build API with provider calls outside scheduling transactions.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::{ProjectId, UserId};
use mkc_github_interface::pull_requests::PullRequests;
use mkc_github_interface::repositories::Repositories;
use mkc_publications::build_eligibility::BuildEligibility;
use mkc_publications::build_head::BuildHeadRecorder;
use mkc_publications::build_scheduler::BuildScheduler;
use mkc_publications::locations::Locations;
use mkc_store_interface::store::Store;

use crate::error::{ApiError, Result};
use crate::payload::{Payload, Reply};

use super::input::Action;

#[unimock::unimock(api = [BuildsConfiguredMock, ExecuteBuildsMock, SetupBuildMock])]
pub(crate) trait BuildsApi: Send + Sync {
    fn configured(&self) -> bool;
    fn execute(&self, actor: Option<UserId>, action: Action, query: &str) -> Result<Reply>;
    fn setup(&self, project: ProjectId) -> Result<()>;
}

pub(crate) struct BuildsService {
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
    pub(crate) scheduler: Arc<dyn BuildScheduler>,
    pub(crate) head_recorder: Arc<dyn BuildHeadRecorder>,
    pub(crate) repositories: Option<Arc<dyn Repositories>>,
    pub(crate) pull_requests: Option<Arc<dyn PullRequests>>,
    pub(crate) locations: Locations,
    pub(crate) configured: bool,
}

impl BuildEligibility for BuildsService {
    fn configured(&self) -> bool {
        self.configured
    }
}

impl BuildsApi for BuildsService {
    fn configured(&self) -> bool {
        self.configured
    }

    fn execute(&self, actor: Option<UserId>, action: Action, query: &str) -> Result<Reply> {
        match action {
            Action::History(project) => self.history(actor, project, query),
            Action::Log(project, build) => self.log(actor, project, build, query),
            Action::Build(project, build) => {
                if !query.is_empty() {
                    return Err(ApiError::ValidationFailed);
                }
                self.build(actor, project, build)
            }
            Action::Request(project, reference) => {
                if !query.is_empty() {
                    return Err(ApiError::ValidationFailed);
                }
                reference.validate()?;
                Ok(Reply::created(Payload::Build(
                    self.request(actor, project, reference)?,
                )))
            }
            Action::Cancel(project, build) => {
                if !query.is_empty() {
                    return Err(ApiError::ValidationFailed);
                }
                self.cancel(actor, project, build)
            }
        }
    }

    fn setup(&self, project: ProjectId) -> Result<()> {
        self.schedule_setup(project)
    }
}
