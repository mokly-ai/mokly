//! One guarded reference observation and stored-head read for every build trigger.

use mkc_store_interface::store::Queries;

use crate::build_scheduler::BuildReference;
use crate::error::{ErrorResultExt, Result};

/// Query-only reconciliation shared by webhook, request and setup transactions.
#[unimock::unimock(api = BuildHeadRecorderMock)]
pub trait BuildHeadRecorder: Send + Sync {
    /// Record the pre-read observation, then return the reference the store holds.
    fn record(
        &self,
        queries: &mut dyn Queries,
        observation: &BuildReference,
    ) -> Result<Option<BuildReference>>;
}

/// Stateless policy over the caller's transaction and guarded provider writes.
pub struct DatabaseBuildHeadRecorder;

impl BuildHeadRecorder for DatabaseBuildHeadRecorder {
    fn record(
        &self,
        queries: &mut dyn Queries,
        observation: &BuildReference,
    ) -> Result<Option<BuildReference>> {
        Ok(match observation {
            BuildReference::Branch(branch) => {
                queries
                    .save_github_branch(branch)
                    .context("record observed build branch")?;
                queries
                    .github_branches(branch.repository_id)
                    .context("read stored build branch")?
                    .into_iter()
                    .find(|stored| stored.name == branch.name)
                    .map(BuildReference::Branch)
            }
            BuildReference::PullRequest(pull) => {
                queries
                    .save_github_pull_request(pull)
                    .context("record observed build pull request")?;
                queries
                    .github_pull_requests(pull.repository_id)
                    .context("read stored build pull request")?
                    .into_iter()
                    .find(|stored| stored.number == pull.number)
                    .map(BuildReference::PullRequest)
            }
        })
    }
}

#[cfg(test)]
#[path = "_tests_/build_head_tests.rs"]
mod tests;
