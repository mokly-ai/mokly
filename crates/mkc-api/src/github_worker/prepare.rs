//! Decode deliveries and fetch current provider state outside database transactions.

use mkc_domain::validation;
use mkc_github_interface::error::Error;
use mkc_github_interface::pull_requests::State;
use mkc_publications::build_scheduler::BuildReference;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_refs::{Branch, PullRequest};
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::store::Callback;
use serde::de::DeserializeOwned;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::events::{
    CheckAction, CheckRunEvent, CheckSuiteEvent, InstallationAction, InstallationEvent, PullAction,
    PullEvent, PushEvent, RepositoriesEvent, RepositoryAction, RepositoryEvent, RepositoryMetadata,
    SelectionAction,
};
use super::handlers::{EventHandler, GitHubHandlers, Prepared};

impl EventHandler for GitHubHandlers {
    fn prepare(&self, delivery: &Delivery) -> Result<Prepared> {
        match delivery.event.as_str() {
            "installation" => {
                let event: InstallationEvent = decode(&delivery.body)?;
                if matches!(event.action, InstallationAction::Unknown) {
                    return Ok(Prepared::Ignored);
                }
                self.installation(event.installation.id)
            }
            "installation_repositories" => {
                let event: RepositoriesEvent = decode(&delivery.body)?;
                if matches!(event.action, SelectionAction::Unknown) {
                    return Ok(Prepared::Ignored);
                }
                self.installation(event.installation.id)
            }
            "repository" => {
                let event: RepositoryEvent = decode(&delivery.body)?;
                self.repository(event.installation.id, &event.repository)?;
                if matches!(event.action, RepositoryAction::Unknown) {
                    return Ok(Prepared::Ignored);
                }
                self.installation(event.installation.id)
            }
            "pull_request" => {
                let event: PullEvent = decode(&delivery.body)?;
                let selection = self.repository(event.installation.id, &event.repository)?;
                if matches!(event.action, PullAction::Unknown) {
                    return Ok(Prepared::Ignored);
                }
                self.pull_request(event, selection)
            }
            "push" => self.push(decode(&delivery.body)?),
            "check_suite" => {
                let event: CheckSuiteEvent = decode(&delivery.body)?;
                let selection = self.repository(event.installation.id, &event.repository)?;
                if matches!(event.action, CheckAction::Unknown)
                    || event.check_suite.app.id != self.app_id
                {
                    return Ok(Prepared::Ignored);
                }
                self.check(selection, event.check_suite.head_sha, None)
            }
            "check_run" => {
                let event: CheckRunEvent = decode(&delivery.body)?;
                let selection = self.repository(event.installation.id, &event.repository)?;
                if !matches!(event.action, CheckAction::Rerequested)
                    || event.check_run.app.id != self.app_id
                {
                    return Ok(Prepared::Ignored);
                }
                self.check(
                    selection,
                    event.check_run.head_sha,
                    Some(event.check_run.id),
                )
            }
            _ => Ok(Prepared::Ignored),
        }
    }
}

impl GitHubHandlers {
    fn repository(&self, installation: i64, repository: &RepositoryMetadata) -> Result<Selection> {
        validate_repository(installation, repository)?;
        let mut selected = None;
        let mut found = false;
        let mut waiting_for_selection = false;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                selected = None;
                found = false;
                waiting_for_selection = false;
                if let Some(record) = queries.github_installation_by_provider(installation)? {
                    found = true;
                    if record.app_id == self.app_id {
                        let candidate = queries
                            .github_repositories(record.id)?
                            .into_iter()
                            .find(|value| value.github_id == repository.id);
                        waiting_for_selection = record.active && candidate.is_none();
                        if let Some(mut candidate) = candidate {
                            if candidate.full_name != repository.full_name
                                || candidate.private != repository.private
                            {
                                candidate.full_name = repository.full_name.clone();
                                candidate.private = repository.private;
                                queries.save_github_repository(&candidate)?;
                            }
                            selected =
                                Some(candidate).filter(|value| record.active && value.active);
                        }
                    }
                }
                Ok(())
            }))
            .context("refresh webhook repository scope")?;
        if !found || waiting_for_selection {
            return Ok(Selection::Waiting);
        }
        Ok(Selection::Known(selected))
    }

    fn pull_request(&self, event: PullEvent, selection: Selection) -> Result<Prepared> {
        let Some(repository) = selection.require()? else {
            return Ok(Prepared::Ignored);
        };
        let updated_at = self.runtime.now();
        let pull =
            self.pull_requests
                .get(event.installation.id, &repository.full_name, event.number)?;
        if pull.number != event.number {
            return Err(ApiError::ValidationFailed);
        }
        let automatic = matches!(
            event.action,
            PullAction::Opened | PullAction::Reopened | PullAction::Synchronize
        );
        let record = PullRequest {
            repository_id: repository.id,
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
        };
        let builds = if automatic {
            self.builds(
                BuildReference::PullRequest(record.clone()),
                BuildTrigger::PullRequest,
            )?
        } else {
            None
        };
        Ok(Prepared::PullRequest {
            record,
            builds,
            recorder: self.head_recorder.clone(),
        })
    }

    fn push(&self, event: PushEvent) -> Result<Prepared> {
        let selection = self.repository(event.installation.id, &event.repository)?;
        let Some(name) = event.reference.strip_prefix("refs/heads/") else {
            return Ok(Prepared::Ignored);
        };
        if name.is_empty() {
            return Err(ApiError::ValidationFailed);
        }
        let Some(repository) = selection.require()? else {
            return Ok(Prepared::Ignored);
        };
        let updated_at = self.runtime.now();
        let head_sha =
            match self
                .repositories
                .branch(event.installation.id, &repository.full_name, name)
            {
                Ok(branch) => Some(branch.commit.sha),
                Err(Error::NotFound) => None,
                Err(error) => return Err(ApiError::from(error)),
            };
        let record = Branch {
            repository_id: repository.id,
            name: name.to_owned(),
            head_sha,
            updated_at,
        };
        let builds = self.builds(BuildReference::Branch(record.clone()), BuildTrigger::Push)?;
        Ok(Prepared::Branch {
            record,
            builds,
            recorder: self.head_recorder.clone(),
        })
    }

    fn check(&self, selection: Selection, head: String, id: Option<i64>) -> Result<Prepared> {
        let Some(repository) = selection.require()? else {
            return Ok(Prepared::Ignored);
        };
        Ok(Prepared::Check {
            repository: repository.id,
            head,
            id,
        })
    }
}

fn validate_repository(installation: i64, repository: &RepositoryMetadata) -> Result<()> {
    if installation <= 0 || repository.id <= 0 || !validation::repository(&repository.full_name) {
        return Err(ApiError::ValidationFailed);
    }
    Ok(())
}

fn decode<T: DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    match serde_json::from_slice(bytes) {
        Ok(value) => Ok(value),
        Err(_) => Err(ApiError::ValidationFailed),
    }
}

/// Missing selections retry handled actions; ignored actions still refresh known metadata.
enum Selection {
    Waiting,
    Known(Option<Repository>),
}

impl Selection {
    fn require(self) -> Result<Option<Repository>> {
        match self {
            Self::Waiting => Err(ApiError::Unavailable),
            Self::Known(repository) => Ok(repository),
        }
    }
}
