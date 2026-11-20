//! Clock-driven authentication cleanup without mail or credential generation.

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use mkc_store_interface::store::{Callback, Store};

use crate::error::{Error, ErrorResultExt, Result};
use crate::runtime::Runtime;
use crate::session_policy::IDLE_LIFETIME;

/// Additional diagnostic retention after the authentication expiry boundary.
pub struct Retention {
    /// Expired link and desktop grant diagnostic lifetime.
    pub links: Duration,
    /// Absolute or idle-expired session diagnostic lifetime.
    pub sessions: Duration,
    /// Already-reset admission counter lifetime.
    pub rate_limits: Duration,
}

/// Committed deleted row counts; contains no credential or account data.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PruneReport {
    /// Expired links removed.
    pub links: usize,
    /// Expired desktop grants removed, including used grants.
    pub desktop_grants: usize,
    /// Expired sessions removed.
    pub sessions: usize,
    /// Stale counters removed.
    pub rate_limits: usize,
}

/// Operator cleanup independent of process scheduling.
#[unimock::unimock(api = PrunerMock)]
pub trait Pruner: Send + Sync {
    /// Delete expired records atomically and return committed row counts.
    fn prune(&self) -> Result<PruneReport>;
}

/// Composition-root cleanup service with query and clock collaborators.
pub struct AuthPruner {
    /// Transactional query boundary.
    pub store: Arc<dyn Store>,
    /// One timestamp captured before the retryable transaction.
    pub runtime: Arc<dyn Runtime>,
    /// Validated configuration, separate from active credential lifetimes.
    pub retention: Retention,
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-auth/prune] retention cutoff exceeds clock range")]
struct CutoffOverflow;

fn cutoff(now: DateTime<Utc>, retention: Duration) -> Result<DateTime<Utc>> {
    let duration = TimeDelta::from_std(retention).context("convert auth retention interval")?;
    now.checked_sub_signed(duration)
        .ok_or_else(|| Error::internal(CutoffOverflow))
}

impl Pruner for AuthPruner {
    fn prune(&self) -> Result<PruneReport> {
        let now = self.runtime.now();
        let link_before = cutoff(now, self.retention.links)?;
        let expires_before = cutoff(now, self.retention.sessions)?;
        let seen_before = expires_before
            .checked_sub_signed(IDLE_LIFETIME)
            .ok_or_else(|| Error::internal(CutoffOverflow))?;
        let rate_before = cutoff(now, self.retention.rate_limits)?;
        let mut report = PruneReport::default();
        self.store
            .transaction(&mut Callback(&mut |queries| {
                report = PruneReport {
                    links: queries.prune_magic_links(link_before)?,
                    desktop_grants: queries.prune_desktop_grants(link_before)?,
                    sessions: queries.prune_sessions(expires_before, seen_before)?,
                    rate_limits: queries.prune_rate_limits(rate_before)?,
                };
                Ok(())
            }))
            .context("commit authentication pruning")?;
        Ok(report)
    }
}

#[cfg(test)]
#[path = "_tests_/prune_tests.rs"]
mod tests;
