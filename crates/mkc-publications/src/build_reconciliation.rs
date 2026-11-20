//! Deployment inventory cleanup independent of worker claim ownership.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use mkc_domain::ids::BuildId;
use sandbox_interface::SandboxBackend;

use crate::error::{Error, ErrorResultExt, Result};
use crate::transaction::Transactions;

#[derive(Debug, thiserror::Error)]
enum ReconciliationFailure {
    #[error("[mkc-publications/build_reconciliation] sandbox inventory unavailable")]
    InventoryUnavailable,
}

/// Every replica may safely reconcile the deployment's exclusive build inventory.
#[unimock::unimock(api = BuildReconcilerMock)]
#[async_trait]
pub trait BuildReconciler: Send + Sync {
    /// Remove unknown, terminal, replaced or uncorrelated sandboxes.
    async fn reconcile(&self) -> Result<usize>;
}

/// Provider identifiers remain ephemeral and never enter persistence or logs.
pub struct SandboxBuildReconciler {
    /// Provider-neutral deployment inventory and destruction.
    pub backend: Arc<dyn SandboxBackend>,
    /// Current running operation lookup.
    pub transactions: Arc<dyn Transactions>,
    /// Inventory namespace exclusive to cloud builds.
    pub deployment_id: String,
}

#[async_trait]
impl BuildReconciler for SandboxBuildReconciler {
    async fn reconcile(&self) -> Result<usize> {
        let inventory = match tokio::time::timeout(
            Duration::from_secs(120),
            self.backend
                .list_managed_sandboxes(self.deployment_id.clone()),
        )
        .await
        {
            Ok(Ok(inventory)) => inventory,
            _ => return Err(Error::internal(ReconciliationFailure::InventoryUnavailable)),
        };
        let mut destroyed = 0;
        for sandbox in inventory {
            let owned = match (sandbox.sandbox_id, sandbox.operation_id) {
                (Some(id), Some(operation)) => {
                    let transactions = self.transactions.clone();
                    tokio::task::spawn_blocking(move || {
                        let mut current = None;
                        transactions.run(true, &mut |queries| {
                            current = queries
                                .build_operation(BuildId(id.as_uuid()))
                                .context("read managed build operation")?;
                            Ok(())
                        })?;
                        Ok::<_, Error>(current == Some(operation.as_uuid()))
                    })
                    .await
                    .context("join build reconciliation lookup")??
                }
                _ => false,
            };
            if !owned {
                match tokio::time::timeout(
                    Duration::from_secs(120),
                    self.backend.destroy_sandbox(sandbox.provider_ref),
                )
                .await
                {
                    Ok(Ok(())) => destroyed += 1,
                    _ => tracing::warn!("build sandbox cleanup will retry"),
                }
            }
        }
        Ok(destroyed)
    }
}

#[cfg(test)]
#[path = "_tests_/build_reconciliation_tests.rs"]
mod tests;
