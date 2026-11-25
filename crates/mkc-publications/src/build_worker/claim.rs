//! Start, reject or recover a build while holding its claim transaction.

use chrono::Duration;
use mkc_build_interface::secret::Secret;
use mkc_store_interface::build_attempt::BuildAttempt;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::publication::PublicationFailure;
use sha2::{Digest, Sha256};

use crate::build_eligibility::BuildEligibility;
use crate::error::{Error, ErrorResultExt, Result};

use super::outcome::{Ending, terminal};
use super::reason::{self, log};
use super::service::{BuildClaim, ClaimedBuild, DatabaseBuildWorker};

impl BuildEligibility for DatabaseBuildWorker {
    fn configured(&self) -> bool {
        true
    }
}

#[cfg(test)]
#[path = "../_tests_/build_worker/availability_tests.rs"]
mod tests;

impl DatabaseBuildWorker {
    pub(super) fn claim_attempt(&self) -> Result<BuildClaim> {
        let Ok(permit) = self.slots.clone().try_acquire_owned() else {
            return Ok(BuildClaim::Idle);
        };
        let operation_id = self.runtime.id();
        let lease_token = self.runtime.id();
        let grant_id = self.runtime.id();
        let raw = format!(
            "mkb_{}",
            self.runtime
                .secret()
                .context("generate build upload credential")?
        );
        let digest: [u8; 32] = Sha256::digest(raw.as_bytes()).into();
        let upload_token = Secret::new(raw).context("validate build upload credential")?;
        let mut claimed = None;
        let mut handled = false;
        let mut recovered = None;
        self.transactions.run(false, &mut |queries| {
            claimed = None;
            handled = false;
            recovered = None;
            let Some(build) = queries
                .claim_build(&|| self.runtime.now())
                .context("claim durable build")?
            else {
                return Ok(());
            };
            let now = self.runtime.now();
            handled = true;
            if build.state == BuildState::Running {
                let ending = if build.publication_id.is_some() {
                    Ending::Settled(terminal(BuildState::Published, None, None, now))
                } else {
                    Ending::Infrastructure(reason::lease_expired(build.step))
                };
                let (finish, warning) = ending.resolve(build.attempt, now);
                let finished = queries
                    .finish_build(build.id, build.lease_token, &finish)
                    .context("recover expired build lease")?;
                if finished && let Some(started) = build.started_at {
                    queries
                        .fail_build_uploads(build.id, started, PublicationFailure::Expired, now)
                        .context("expire recovered build uploads")?;
                }
                if finished {
                    recovered = warning.map(|warning| (build.id, warning));
                }
                return Ok(());
            }
            let Some(access) = self
                .access(queries, build.project_id)?
                .filter(|value| value.repository.id == build.repository_id)
            else {
                queries
                    .finish_build(
                        build.id,
                        None,
                        &terminal(
                            BuildState::Failed,
                            Some(BuildFailure::RepositoryUnavailable),
                            None,
                            now,
                        ),
                    )
                    .context("refuse unavailable build repository")?;
                return Ok(());
            };
            if !self.publishing_allowed(queries, &access.project)? {
                queries
                    .finish_build(
                        build.id,
                        None,
                        &terminal(
                            BuildState::Failed,
                            Some(BuildFailure::PlanRequired),
                            None,
                            now,
                        ),
                    )
                    .context("refuse build publication plan")?;
                return Ok(());
            }
            let now = self.runtime.now();
            let attempt = BuildAttempt {
                now,
                operation_id,
                lease_token,
                lease_expires_at: now + Duration::minutes(2),
                deadline_at: now + Duration::minutes(15),
            };
            let Some(started) = queries
                .start_build(build.id, &attempt)
                .context("start claimed build")?
            else {
                return Ok(());
            };
            let minted = queries
                .mint_build_grant(&BuildUploadGrant {
                    id: grant_id,
                    build_id: started.id,
                    attempt: started.attempt,
                    token_digest: digest,
                    expires_at: attempt.deadline_at,
                    consumed_at: None,
                    outcome: None,
                    created_at: now,
                })
                .context("mint attempt upload grant")?;
            if !minted {
                return Err(Error::Unavailable);
            }
            claimed = Some((started, access));
            Ok(())
        })?;
        if let Some((build, warning)) = recovered {
            log(build, &warning);
        }
        match claimed {
            Some((build, access)) => Ok(BuildClaim::Attempt(Box::new(ClaimedBuild {
                build,
                upload_token,
                installation: access.installation.github_id,
                repository: access.repository.github_id,
                repository_name: access.repository.full_name,
                _permit: permit,
            }))),
            None if handled => Ok(BuildClaim::Handled),
            None => Ok(BuildClaim::Idle),
        }
    }
}
