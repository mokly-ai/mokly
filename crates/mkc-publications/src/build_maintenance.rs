//! Database-only build retention and build check dead-letter recovery.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_domain::ids::BuildId;

use crate::error::{ErrorResultExt, Result};
use crate::transaction::Transactions;

/// Trusted operator commands; no provider or file-store dependency.
#[unimock::unimock(api = BuildMaintenanceMock)]
pub trait BuildMaintenance: Send + Sync {
    /// Delete at most one thousand finished builds at the inclusive cutoff.
    fn prune(&self, retention_seconds: u32) -> Result<i64>;
    /// Requeue one undelivered dead letter, preserving its state version.
    fn requeue(&self, build: BuildId) -> Result<bool>;
}

/// Maintenance shares normal serializable query execution and runtime time.
pub struct DatabaseBuildMaintenance {
    /// Query-only maintenance transactions.
    pub transactions: Arc<dyn Transactions>,
    /// Captured cutoff and recovery timestamps.
    pub runtime: Arc<dyn Runtime>,
}

impl BuildMaintenance for DatabaseBuildMaintenance {
    fn prune(&self, retention_seconds: u32) -> Result<i64> {
        let cutoff = self.runtime.now() - Duration::seconds(i64::from(retention_seconds));
        let mut count = 0;
        self.transactions.run(false, &mut |queries| {
            count = queries
                .prune_builds(cutoff, 1_000)
                .context("prune retained builds")?;
            Ok(())
        })?;
        Ok(count)
    }

    fn requeue(&self, build: BuildId) -> Result<bool> {
        let at = self.runtime.now();
        let mut requeued = false;
        self.transactions.run(false, &mut |queries| {
            requeued = queries
                .requeue_build_check(build, at)
                .context("recover dead build check")?;
            Ok(())
        })?;
        Ok(requeued)
    }
}

#[cfg(test)]
#[path = "_tests_/build_maintenance_tests.rs"]
mod tests;
