//! Queue claiming and retry orchestration for billing deliveries.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_billing_interface::provider::BillingProvider;
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::{Callback, Store};

use crate::error::{ErrorResultExt, Result};
use crate::prices::VerifiedPriceIds;

use super::retry::{AttemptError, due_at};

/// One-step durable billing delivery worker.
#[unimock::unimock(api = BillingDeliveryWorkerMock)]
pub trait BillingDeliveryWorker: Send + Sync {
    /// Process at most one due delivery and report whether work was claimed.
    fn run_once(&self) -> Result<bool>;
}

/// Store-backed worker using one provider and fenced five-minute leases.
pub struct DatabaseBillingDeliveryWorker {
    pub(super) store: Arc<dyn Store>,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) provider: Arc<dyn BillingProvider>,
    pub(super) prices: Option<VerifiedPriceIds>,
}

impl DatabaseBillingDeliveryWorker {
    /// Construct a worker with any identities verified during startup.
    pub fn new(
        store: Arc<dyn Store>,
        runtime: Arc<dyn Runtime>,
        provider: Arc<dyn BillingProvider>,
        prices: Option<VerifiedPriceIds>,
    ) -> Self {
        Self {
            store,
            runtime,
            provider,
            prices,
        }
    }

    fn failed(&self, delivery: &BillingDelivery, error: &AttemptError) -> Result<()> {
        let now = self.runtime.now();
        let policy = error.policy();
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let Some(mut current) = queries.billing_delivery(&delivery.id)? else {
                    return Ok(());
                };
                if current.lease != delivery.lease || current.status != DeliveryStatus::Processing {
                    return Ok(());
                }
                current.status = if policy.terminal || current.attempts >= 8 {
                    DeliveryStatus::Failed
                } else {
                    DeliveryStatus::Pending
                };
                current.due_at = due_at(now, current.attempts, policy.retry_after);
                current.lease = None;
                current.lease_until = None;
                current.last_failure = Some(policy.category);
                queries.save_billing_delivery(&current)
            }))
            .context("persist billing delivery failure")
    }
}

impl BillingDeliveryWorker for DatabaseBillingDeliveryWorker {
    fn run_once(&self) -> Result<bool> {
        let now = self.runtime.now();
        let lease = self.runtime.id();
        let mut delivery = None;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                queries.expire_billing_deliveries(now)?;
                delivery =
                    queries.claim_billing_delivery(now, lease, now + Duration::minutes(5))?;
                Ok(())
            }))
            .context("claim next billing delivery")?;
        let Some(delivery) = delivery else {
            return Ok(false);
        };
        let result = self
            .prepare(&delivery.body)
            .and_then(|prepared| self.apply(&delivery, lease, prepared));
        if let Err(error) = result {
            tracing::warn!(delivery_id = %delivery.id, attempts = delivery.attempts, "billing delivery will be retried or retained");
            self.failed(&delivery, &error)?;
        }
        Ok(true)
    }
}

#[cfg(test)]
#[path = "_tests_/worker_tests.rs"]
mod tests;
