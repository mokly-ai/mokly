//! Bounded retention of GitHub authentication and delivery records.

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_auth::runtime::Runtime;
use mkc_store_interface::store::{Callback, Store};

use crate::error::{ApiError, ApiErrorResultExt, Result};

const BATCH_SIZE: i64 = 1000;
const MAX_BATCHES: usize = 10_000;

/// Retention after each GitHub record's lifecycle boundary.
pub struct Retention {
    /// Time to retain an expired OAuth state/verifier hash.
    pub oauth_flows: Duration,
    /// Time to retain a terminal raw webhook delivery.
    pub deliveries: Duration,
}

/// Committed deleted row counts without provider payloads or identities.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PruneReport {
    /// Expired OAuth flows removed.
    pub oauth_flows: usize,
    /// Terminal webhook deliveries removed.
    pub deliveries: usize,
}

/// Trusted GitHub record cleanup independent of deployment scheduling.
#[unimock::unimock(api = GitHubPrunerMock)]
pub trait GitHubPruner: Send + Sync {
    /// Exhaust bounded eligible batches and return committed counts.
    fn prune(&self) -> Result<PruneReport>;
}

/// Store-backed cleanup using one injected clock observation.
pub struct GitHubPrune {
    /// Transactional query boundary.
    pub store: Arc<dyn Store>,
    /// Clock captured once for stable cutoffs across batches.
    pub runtime: Arc<dyn Runtime>,
    /// Validated retention windows.
    pub retention: Retention,
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-api/maintenance/github] retention cutoff exceeds clock range")]
struct CutoffOverflow;

fn cutoff(now: DateTime<Utc>, retention: Duration) -> Result<DateTime<Utc>> {
    let duration = TimeDelta::from_std(retention).context("convert GitHub retention interval")?;
    now.checked_sub_signed(duration)
        .ok_or_else(|| ApiError::internal(CutoffOverflow))
}

impl GitHubPruner for GitHubPrune {
    fn prune(&self) -> Result<PruneReport> {
        let now = self.runtime.now();
        let oauth_before = cutoff(now, self.retention.oauth_flows)?;
        let delivery_before = cutoff(now, self.retention.deliveries)?;
        let mut report = PruneReport::default();
        let mut oauth_complete = false;
        for _ in 0..MAX_BATCHES {
            let mut deleted = 0;
            self.store
                .transaction(&mut Callback(&mut |queries| {
                    deleted = queries.prune_github_oauth_flows(oauth_before, BATCH_SIZE)?;
                    Ok(())
                }))
                .context("commit GitHub OAuth pruning")?;
            report.oauth_flows += deleted;
            if deleted < BATCH_SIZE as usize {
                oauth_complete = true;
                break;
            }
        }
        if !oauth_complete {
            return Err(ApiError::Unavailable);
        }
        let mut deliveries_complete = false;
        for _ in 0..MAX_BATCHES {
            let mut deleted = 0;
            self.store
                .transaction(&mut Callback(&mut |queries| {
                    deleted = queries.prune_github_deliveries(delivery_before, BATCH_SIZE)?;
                    Ok(())
                }))
                .context("commit GitHub delivery pruning")?;
            report.deliveries += deleted;
            if deleted < BATCH_SIZE as usize {
                deliveries_complete = true;
                break;
            }
        }
        if !deliveries_complete {
            return Err(ApiError::Unavailable);
        }
        Ok(report)
    }
}

#[cfg(test)]
#[path = "_tests_/github_tests.rs"]
mod tests;
