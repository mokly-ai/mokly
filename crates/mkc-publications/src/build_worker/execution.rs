//! Attempt execution with periodic renewal and cancellation by dropping the run.

use std::sync::Arc;
use std::time::Duration;

use chrono::Duration as ChronoDuration;
use mkc_build_interface::input::{Branch, ConfigPath, HeadSha, Repository, UploadEndpoint};
use mkc_build_interface::log::BuildLogSink;
use mkc_build_interface::request::{BuildRequest, Comparison};
use mkc_build_interface::secret::Secret;
use mkc_github_interface::error::Error as ProviderError;

use crate::error::{Error, ErrorResultExt, Result};

use super::finalize::{AttemptFinalizer, AttemptResult, Finalizer};
use super::reason::{mint_reason, request_reason};
use super::service::{ClaimedBuild, DatabaseBuildWorker};
use super::sink::AttemptSink;

impl DatabaseBuildWorker {
    pub(super) async fn run_attempt(&self, attempt: ClaimedBuild) -> Result<()> {
        let mut execution = Box::pin(self.execute_owned(&attempt));
        loop {
            tokio::select! {
                result = &mut execution => return result,
                () = self.clock.sleep(Duration::from_secs(30)) => {
                    let transactions = self.transactions.clone();
                    let runtime = self.runtime.clone();
                    let id = attempt.build.id;
                    let lease = attempt.build.lease_token.ok_or(super::sink::lost())?;
                    let renewed = tokio::task::spawn_blocking(move || {
                        let mut renewed = false;
                        transactions.run(false, &mut |queries| {
                            renewed = queries.renew_build(id, lease, &|| runtime.now(), ChronoDuration::minutes(2)).context("renew build lease")?;
                            Ok(())
                        })?;
                        Ok::<_, Error>(renewed)
                    }).await.context("join build renewal")??;
                    if !renewed { return Ok(()); }
                }
            }
        }
    }

    async fn execute_owned(&self, attempt: &ClaimedBuild) -> Result<()> {
        let credentials = self.credentials.clone();
        let installation = attempt.installation;
        let repository = attempt.repository;
        let token = tokio::task::spawn_blocking(move || {
            credentials.repository_read(installation, repository)
        })
        .await
        .context("join repository credential mint")?;
        let result = match token {
            Ok(token) => {
                let request = match self.request(attempt, token.expose()) {
                    Ok(request) => request,
                    Err(error) => {
                        let reason = request_reason(&error);
                        return self
                            .finalize_attempt(attempt, AttemptResult::Infrastructure(reason))
                            .await;
                    }
                };
                let sink: Arc<dyn BuildLogSink> = Arc::new(AttemptSink {
                    transactions: self.transactions.clone(),
                    runtime: self.runtime.clone(),
                    build: attempt.build.id,
                    operation: request.attempt_operation_id,
                    lease: attempt.build.lease_token.ok_or(super::sink::lost())?,
                });
                AttemptResult::Runner(self.runner.run(request, sink).await)
            }
            Err(ProviderError::Forbidden | ProviderError::NotFound) => {
                AttemptResult::RepositoryUnavailable
            }
            Err(error) => AttemptResult::Infrastructure(mint_reason(&error)),
        };
        self.finalize_attempt(attempt, result).await
    }

    async fn finalize_attempt(&self, attempt: &ClaimedBuild, result: AttemptResult) -> Result<()> {
        let finalizer: Arc<dyn AttemptFinalizer> = Arc::new(Finalizer {
            transactions: self.transactions.clone(),
            runtime: self.runtime.clone(),
        });
        let build = attempt.build.clone();
        tokio::task::spawn_blocking(move || finalizer.finish(&build, result))
            .await
            .context("join build finalization")?
    }

    fn request(&self, attempt: &ClaimedBuild, installation_token: &str) -> Result<BuildRequest> {
        let build = &attempt.build;
        Ok(BuildRequest {
            build_id: build.id.0,
            attempt_operation_id: build.attempt_operation_id.ok_or(super::sink::lost())?,
            project_id: build.project_id,
            repository: Repository::new(attempt.repository_name.clone())
                .context("validate build repository")?,
            head_sha: HeadSha::new(build.head_sha.clone()).context("validate build head")?,
            branch: Branch::new(build.branch.clone()).context("validate build branch")?,
            comparison: match &build.base_ref {
                Some(base) => Comparison::Base {
                    base_ref: Branch::new(base.clone()).context("validate build base")?,
                },
                None => Comparison::CurrentOnly,
            },
            config_path: ConfigPath::new(build.config_path.clone())
                .context("validate build config path")?,
            deadline_at: build.deadline_at.ok_or(super::sink::lost())?,
            upload_endpoint: UploadEndpoint::new(
                &format!(
                    "{}/v1/projects/{}/publications",
                    self.config.api_origin, build.project_id
                ),
                build.project_id,
            )
            .context("build project upload endpoint")?,
            upload_token: attempt.upload_token.clone(),
            installation_token: Secret::new(installation_token)
                .context("validate repository credential")?,
        })
    }
}
