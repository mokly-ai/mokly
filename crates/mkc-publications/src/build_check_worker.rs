//! Per-row build outbox claims with attempt-fenced provider outcomes.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_domain::ids::ProjectId;
use mkc_github_interface::check::CheckRuns;

use crate::build_check_delivery::BuildDelivery;
use crate::check_delivery::CheckRenderer;
use crate::error::{ErrorResultExt, Result};
use crate::locations::Locations;
use crate::transaction::Transactions;

/// One bounded build check delivery batch.
#[unimock::unimock(api = BuildChecksWorkerMock)]
pub trait BuildChecksWorker: Send + Sync {
    /// Process up to one hundred due checks, optionally restricted to a project.
    fn run_batch(&self, project: Option<ProjectId>) -> Result<usize>;
}

/// Build outbox delivery shares the publication result renderer.
pub struct BuildCheckDelivery {
    /// Short, query-only claims and fenced outcome writes.
    pub transactions: Arc<dyn Transactions>,
    /// Stable provider upserts outside transactions.
    pub github: Arc<dyn CheckRuns>,
    /// Publication Changes rendering, shared with publication check events.
    pub publications: Arc<dyn CheckRenderer>,
    /// Claim and retry timestamps.
    pub runtime: Arc<dyn Runtime>,
    /// Current app origin for canonical build links.
    pub locations: Locations,
}

impl BuildChecksWorker for BuildCheckDelivery {
    fn run_batch(&self, project: Option<ProjectId>) -> Result<usize> {
        let now = self.runtime.now();
        let mut pending = Vec::new();
        self.transactions.run(true, &mut |queries| {
            pending = queries
                .pending_build_checks(now, 100, project)
                .context("read build check outbox")?;
            Ok(())
        })?;
        let mut delivered = 0;
        for row in pending {
            let at = self.runtime.now();
            let mut claim = None;
            self.transactions.run(false, &mut |queries| {
                claim = queries
                    .claim_build_check(row.build_id, row.attempts, at)
                    .context("claim one build check")?;
                Ok(())
            })?;
            let Some(claim) = claim else {
                continue;
            };
            if let Err(error) = self.deliver_build(claim.build_id) {
                let at = self.runtime.now();
                let next = at + Duration::seconds((60_i64 << row.attempts.clamp(0, 6)).min(3600));
                let mut recorded = false;
                self.transactions.run(false, &mut |queries| {
                    recorded = queries
                        .retry_build_check(
                            row.build_id,
                            claim.attempts,
                            error.is_permanent(),
                            next,
                            at,
                        )
                        .context("record fenced build check failure")?;
                    Ok(())
                })?;
                if recorded {
                    tracing::warn!(build_id = %row.build_id, attempts = claim.attempts, ?error, "build check delivery failed");
                }
                continue;
            }
            let mut recorded = false;
            self.transactions.run(false, &mut |queries| {
                recorded = queries
                    .deliver_build_check(row.build_id, claim.attempts, claim.version)
                    .context("acknowledge claimed build check version")?;
                Ok(())
            })?;
            delivered += usize::from(recorded);
        }
        Ok(delivered)
    }
}

#[cfg(test)]
#[path = "_tests_/build_checks/mod.rs"]
mod tests;
