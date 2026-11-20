//! Installation-authorized delivery with recovery after an uncertain provider create.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_github_interface::check::{CheckRun, CheckRuns, Conclusion, Error, ErrorResultExt, Result};
use mkc_github_interface::checks::{self, Checks, Create, Output, Status, Update};
use mkc_github_interface::error;
use mkc_store_interface::github_check;
use mkc_store_interface::store::{Callback, Store};

/// Provider adapter constructed at the API composition root.
pub struct GitHubCheckRuns {
    /// Query-only transactions; none enclose provider requests.
    pub store: Arc<dyn Store>,
    /// GitHub App check transport.
    pub checks: Arc<dyn Checks>,
    /// Cloud IDs for created or recovered provider records.
    pub runtime: Arc<dyn Runtime>,
    /// Registered deployment App, used to scope recovery reads.
    pub app_id: i64,
}

impl CheckRuns for GitHubCheckRuns {
    fn upsert(&self, check: &CheckRun) -> Result<()> {
        if (check.status == Status::Completed) != check.conclusion.is_some()
            || check.name != "Mokly"
            || self.app_id <= 0
        {
            return Err(Error::Validation);
        }
        let mut context = None;
        self.store
            .read(&mut Callback(&mut |queries| {
                let Some(project) = queries.project(check.project_id)? else {
                    return Ok(());
                };
                let Some(repository) = queries.github_project_repository(project.id)? else {
                    return Ok(());
                };
                let Some(installation) = queries.github_installation(repository.installation_id)?
                else {
                    return Ok(());
                };
                if !installation.connected
                    || installation.organization_id != Some(project.organization_id)
                {
                    return Ok(());
                }
                let recorded =
                    queries.github_check_by_external_id(project.id, &check.external_id)?;
                context = Some((repository, installation, recorded));
                Ok(())
            }))
            .context("resolve publication check installation")?;
        let Some((repository, installation, recorded)) = context else {
            return Ok(());
        };
        if !installation.active {
            return Err(provider_error(error::Error::Unavailable));
        }
        if installation.app_id != self.app_id || !repository.active {
            return Err(Error::Http {
                status: 404,
                rate_limited: false,
            });
        }
        let update = update(check);
        if let Some(recorded) = recorded {
            if recorded.repository_id != repository.id || recorded.head_sha != check.head_sha {
                return Err(Error::Validation);
            }
            let run = self.checks.update(
                installation.github_id,
                &repository.full_name,
                recorded.github_id,
                &update,
            );
            let run = match run {
                Ok(run) => run,
                Err(error) => return Err(provider_error(error)),
            };
            return validate_run(&run, check);
        }
        let runs = match self.checks.list(
            installation.github_id,
            &repository.full_name,
            &check.head_sha,
            self.app_id,
        ) {
            Ok(runs) => runs,
            Err(error) => return Err(provider_error(error)),
        };
        let recovered = runs
            .into_iter()
            .find(|run| run.external_id.as_deref() == Some(&check.external_id));
        let (run, needs_update) = match recovered {
            Some(run) => (run, true),
            None => {
                let input = Create {
                    name: check.name.clone(),
                    head_sha: check.head_sha.clone(),
                    external_id: check.external_id.clone(),
                    details_url: check.details_url.clone(),
                    update: Update {
                        details_url: None,
                        ..update.clone()
                    },
                };
                match self
                    .checks
                    .create(installation.github_id, &repository.full_name, &input)
                {
                    Ok(run) => (run, false),
                    Err(error) => return Err(provider_error(error)),
                }
            }
        };
        validate_run(&run, check)?;
        let record = github_check::CheckRun {
            id: self.runtime.id(),
            project_id: check.project_id,
            repository_id: repository.id,
            github_id: run.id,
            head_sha: check.head_sha.clone(),
            external_id: check.external_id.clone(),
            rerequested: false,
        };
        self.store
            .transaction(&mut Callback(&mut |queries| {
                queries.record_github_check(&record)
            }))
            .context("record created or recovered GitHub check")?;
        if needs_update {
            let run = match self.checks.update(
                installation.github_id,
                &repository.full_name,
                run.id,
                &update,
            ) {
                Ok(run) => run,
                Err(error) => return Err(provider_error(error)),
            };
            validate_run(&run, check)?;
        }
        Ok(())
    }
}

fn update(check: &CheckRun) -> Update {
    Update {
        details_url: Some(check.details_url.clone()),
        status: check.status,
        conclusion: check.conclusion.map(|conclusion| match conclusion {
            Conclusion::Success => checks::Conclusion::Success,
            Conclusion::Neutral => checks::Conclusion::Neutral,
            Conclusion::Failure => checks::Conclusion::Failure,
            Conclusion::Cancelled => checks::Conclusion::Cancelled,
        }),
        output: Some(Output {
            title: check.title.clone(),
            summary: check.summary.clone(),
            text: None,
        }),
    }
}

fn validate_run(run: &checks::CheckRun, check: &CheckRun) -> Result<()> {
    if run.id <= 0
        || run.head_sha != check.head_sha
        || run.external_id.as_deref() != Some(&check.external_id)
    {
        return Err(Error::internal(error::Error::InvalidRequest));
    }
    Ok(())
}

#[track_caller]
fn provider_error(error: error::Error) -> Error {
    let status = match error {
        error::Error::InvalidRequest => return Error::Validation,
        error::Error::Unauthorized => 401,
        error::Error::Forbidden => 403,
        error::Error::NotFound => 404,
        error::Error::Http { status } => status,
        error::Error::RateLimited { .. } => {
            return Error::Http {
                status: 429,
                rate_limited: true,
            };
        }
        error => return Error::internal(error),
    };
    Error::Http {
        status,
        rate_limited: false,
    }
}
