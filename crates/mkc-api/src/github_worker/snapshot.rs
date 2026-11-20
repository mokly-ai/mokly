//! Current installation snapshots fetched outside the delivery completion transaction.

use mkc_github_interface::error::Error;

use crate::error::{ApiError, Result};
use crate::github::reconciliation::Snapshot;

use super::handlers::{GitHubHandlers, Prepared};

impl GitHubHandlers {
    pub(super) fn installation(&self, github_id: i64) -> Result<Prepared> {
        if github_id <= 0 {
            return Err(ApiError::ValidationFailed);
        }
        let observed_at = self.runtime.now();
        self.tokens.invalidate(github_id)?;
        let installation = match self.repositories.installation(github_id) {
            Ok(installation) => installation,
            Err(Error::NotFound) => {
                return Ok(Prepared::Installation(Snapshot::Removed {
                    github_id,
                    observed_at,
                }));
            }
            Err(error) => return Err(ApiError::from(error)),
        };
        if installation.app_id != self.app_id || installation.id != github_id {
            return Ok(Prepared::Ignored);
        }
        let repositories = if installation.suspended_at.is_none() {
            self.repositories.repositories(github_id)?
        } else {
            Vec::new()
        };
        let repositories = repositories
            .into_iter()
            .map(|repository| (self.runtime.id().into(), repository))
            .collect();
        Ok(Prepared::Installation(Snapshot::Available {
            id: self.runtime.id().into(),
            installation,
            repositories,
            observed_at,
        }))
    }
}
