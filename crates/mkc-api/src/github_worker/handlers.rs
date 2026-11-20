//! Provider reconciliation dependencies for each supported delivery family.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::RepositoryId;
use mkc_github_interface::credentials::Tokens;
use mkc_github_interface::pull_requests::PullRequests;
use mkc_github_interface::repositories::Repositories;
use mkc_publications::build_head::BuildHeadRecorder;
use mkc_publications::build_scheduler::BuildScheduler;
use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_refs::{Branch, PullRequest};
use mkc_store_interface::store::Store;

use crate::error::Result;
use crate::github::reconciliation::Snapshot;

use super::builds::PreparedBuildEffects;

pub(crate) enum Prepared {
    Installation(Snapshot),
    PullRequest {
        record: PullRequest,
        recorder: Arc<dyn BuildHeadRecorder>,
        builds: Option<Arc<dyn PreparedBuildEffects>>,
    },
    Branch {
        record: Branch,
        recorder: Arc<dyn BuildHeadRecorder>,
        builds: Option<Arc<dyn PreparedBuildEffects>>,
    },
    Check {
        repository: RepositoryId,
        head: String,
        id: Option<i64>,
    },
    Ignored,
}

#[unimock::unimock(api = [PrepareEventMock])]
pub(crate) trait EventHandler: Send + Sync {
    fn prepare(&self, delivery: &Delivery) -> Result<Prepared>;
}

pub(crate) struct GitHubHandlers {
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
    pub(crate) repositories: Arc<dyn Repositories>,
    pub(crate) pull_requests: Arc<dyn PullRequests>,
    pub(crate) tokens: Arc<dyn Tokens>,
    pub(crate) app_id: i64,
    pub(crate) head_recorder: Arc<dyn BuildHeadRecorder>,
    pub(crate) build_scheduler: Option<Arc<dyn BuildScheduler>>,
}
