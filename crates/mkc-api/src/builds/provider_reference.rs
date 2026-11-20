//! Provider reads carry the observation time captured before network work.

use mkc_github_interface::pull_requests::State;
use mkc_publications::build_eligibility::BuildAccess;
use mkc_publications::build_scheduler::BuildReference;
use mkc_store_interface::github_refs::{Branch, PullRequest};

use crate::build_error::BuildError;
use crate::error::{ApiError, Result};

use super::input::Reference;
use super::service::BuildsService;

impl BuildsService {
    pub(super) fn reference(
        &self,
        access: &BuildAccess,
        reference: &Reference,
    ) -> Result<BuildReference> {
        let updated_at = self.runtime.now();
        let installation = access.installation.github_id;
        let repository = &access.repository.full_name;
        Ok(match reference {
            Reference::Branch(input) => {
                let provider = self
                    .repositories
                    .as_deref()
                    .ok_or(ApiError::Build(BuildError::Unavailable))?;
                let branch = provider.branch(installation, repository, &input.branch)?;
                BuildReference::Branch(Branch {
                    repository_id: access.repository.id,
                    name: branch.name,
                    head_sha: Some(branch.commit.sha),
                    updated_at,
                })
            }
            Reference::PullRequest(input) => {
                let provider = self
                    .pull_requests
                    .as_deref()
                    .ok_or(ApiError::Build(BuildError::Unavailable))?;
                let pull = provider.get(installation, repository, input.pull_request)?;
                BuildReference::PullRequest(PullRequest {
                    repository_id: access.repository.id,
                    number: pull.number,
                    title: pull.title,
                    author: pull.author,
                    open: pull.state == State::Open,
                    merged: pull.merged,
                    head_ref: pull.head.name,
                    head_sha: pull.head.sha,
                    base_ref: pull.base.name,
                    base_sha: pull.base.sha,
                    head_repository_id: pull.head.repo.map(|repo| repo.id),
                    base_repository_id: pull.base.repo.map(|repo| repo.id),
                    updated_at,
                })
            }
        })
    }
}
