//! Query-only build re-run rules committed with provider rerequest consumption.

use std::array;
use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::BuildId;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::error;
use mkc_store_interface::github_check::CheckRun;
use mkc_store_interface::store::{Callback, Queries, Store};
use uuid::Uuid;

use crate::build_scheduler::{BuildReference, BuildSchedule, BuildScheduler};
use crate::check_rerequests::CheckRerequests;
use crate::error::{ErrorResultExt, Result};

/// Failed current heads rebuild; all other valid marks re-deliver their result.
pub struct BuildCheckRerequests {
    /// Claims parents before each bounded set of marks and commits their effects.
    pub store: Arc<dyn Store>,
    /// Query-only eligibility and duplicate protection.
    pub scheduler: Arc<dyn BuildScheduler>,
    /// Pre-generated IDs and due time, stable across transaction retries.
    pub runtime: Arc<dyn Runtime>,
}

impl CheckRerequests for BuildCheckRerequests {
    fn run_batch(&self) -> Result<usize> {
        let at = self.runtime.now();
        let ids: [Uuid; 100] = array::from_fn(|_| self.runtime.id());
        let mut count = 0;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                count = 0;
                for (check, id) in queries
                    .rerequested_github_checks("mokly-build:", 100)?
                    .into_iter()
                    .zip(ids)
                {
                    if let Some(build) = self.matching_build(queries, &check)? {
                        let mut scheduled = None;
                        if matches!(
                            build.state,
                            BuildState::Failed | BuildState::TimedOut | BuildState::Cancelled
                        ) {
                            let reference = match build.pull_request {
                                Some(number) => queries
                                    .github_pull_requests(build.repository_id)?
                                    .into_iter()
                                    .find(|pull| {
                                        pull.number == number && pull.head_sha == build.head_sha
                                    })
                                    .map(|mut pull| {
                                        pull.head_ref = build.branch.clone();
                                        if let Some(base) = &build.base_ref {
                                            pull.base_ref = base.clone();
                                        }
                                        BuildReference::PullRequest(pull)
                                    }),
                                None => queries
                                    .github_branches(build.repository_id)?
                                    .into_iter()
                                    .find(|branch| {
                                        branch.name == build.branch
                                            && branch.head_sha.as_deref() == Some(&build.head_sha)
                                    })
                                    .map(BuildReference::Branch),
                            };
                            if let Some(reference) = reference {
                                scheduled = error::ErrorResultExt::context(
                                    self.scheduler.schedule(
                                        queries,
                                        &BuildSchedule {
                                            id: id.into(),
                                            project_id: build.project_id,
                                            trigger: BuildTrigger::Rerun,
                                            reference,
                                            at,
                                            rerun_base_ref: build.base_ref.clone(),
                                        },
                                    ),
                                    "schedule current-head build rerequest",
                                )?;
                            }
                        }
                        if scheduled.is_none() {
                            queries.bump_build_check(build.id, at)?;
                        }
                        count += 1;
                    }
                    queries.clear_github_check_rerequest(check.id)?;
                }
                Ok(())
            }))
            .context("consume build check rerequests")?;
        Ok(count)
    }
}

impl BuildCheckRerequests {
    fn matching_build(
        &self,
        queries: &mut dyn Queries,
        check: &CheckRun,
    ) -> error::Result<Option<Build>> {
        let Some(id) = check
            .external_id
            .strip_prefix("mokly-build:")
            .and_then(|id| id.parse::<Uuid>().ok())
        else {
            return Ok(None);
        };
        let Some(build) = queries.build(check.project_id, BuildId(id))? else {
            return Ok(None);
        };
        if build.head_sha != check.head_sha || build.repository_id != check.repository_id {
            return Ok(None);
        }
        let Some(repository) = queries.github_project_repository(check.project_id)? else {
            return Ok(None);
        };
        if repository.id != build.repository_id {
            return Ok(None);
        }
        Ok(Some(build))
    }
}

#[cfg(test)]
#[path = "_tests_/build_rerequests_tests.rs"]
mod tests;
