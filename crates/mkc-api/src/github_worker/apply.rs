//! Query-only effects committed together with the delivery's final status.

use mkc_publications::build_scheduler::BuildReference;
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::Queries;

use crate::error::{ApiErrorResultExt, Result};
use crate::github::reconciliation::InstallationUpdate;

use super::handlers::Prepared;

pub(super) trait PreparedEvent {
    fn apply(&self, queries: &mut dyn Queries) -> Result<DeliveryStatus>;
}

impl PreparedEvent for Prepared {
    fn apply(&self, queries: &mut dyn Queries) -> Result<DeliveryStatus> {
        match self {
            Self::Installation(snapshot) => {
                let update: &dyn InstallationUpdate = snapshot;
                update.apply(queries, None)?;
            }
            Self::PullRequest {
                record,
                builds,
                recorder,
            } => {
                let stored = recorder
                    .record(queries, &BuildReference::PullRequest(record.clone()))
                    .context("apply GitHub PR observation")?;
                if let (Some(builds), Some(stored)) = (builds, stored) {
                    builds.apply(queries, &stored)?;
                }
            }
            Self::Branch {
                record,
                builds,
                recorder,
            } => {
                let stored = recorder
                    .record(queries, &BuildReference::Branch(record.clone()))
                    .context("apply GitHub branch observation")?;
                if let (Some(builds), Some(stored)) = (builds, stored) {
                    builds.apply(queries, &stored)?;
                }
            }
            Self::Check {
                repository,
                head,
                id,
            } => {
                let mut changed = false;
                for mut check in queries
                    .github_checks(*repository)
                    .context("read checks for GitHub rerequest")?
                {
                    if check.head_sha == *head && id.is_none_or(|id| id == check.github_id) {
                        check.rerequested = true;
                        queries
                            .save_github_check(&check)
                            .context("persist GitHub check rerequest")?;
                        changed = true;
                    }
                }
                if !changed {
                    return Ok(DeliveryStatus::Ignored);
                }
            }
            Self::Ignored => return Ok(DeliveryStatus::Ignored),
        }
        Ok(DeliveryStatus::Done)
    }
}
