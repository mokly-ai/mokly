//! Operator recovery for retained billing delivery failures.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::{Callback, Store};

use crate::error::{ErrorResultExt, Result};

/// Trusted maintenance boundary for billing delivery inspection and recovery.
#[unimock::unimock(api = BillingRecoveryMock)]
pub trait BillingRecovery: Send + Sync {
    /// Requeue one failed delivery, returning false when it is absent or ineligible.
    fn requeue(&self, event_id: &str) -> Result<bool>;
    /// Count deliveries retained in the failed state.
    fn dead_letters(&self) -> Result<i64>;
}

/// Store-backed billing delivery recovery requiring no provider credentials.
pub struct StoreBillingRecovery {
    /// Shared transactional store.
    pub store: Arc<dyn Store>,
    /// Clock used to make recovered deliveries due immediately.
    pub runtime: Arc<dyn Runtime>,
}

impl BillingRecovery for StoreBillingRecovery {
    fn requeue(&self, event_id: &str) -> Result<bool> {
        let now = self.runtime.now();
        let mut changed = false;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                changed = false;
                let Some(mut delivery) = queries.billing_delivery(event_id)? else {
                    return Ok(());
                };
                if delivery.status != DeliveryStatus::Failed {
                    return Ok(());
                }
                delivery.status = DeliveryStatus::Pending;
                delivery.due_at = now;
                delivery.attempts = 0;
                delivery.lease = None;
                delivery.lease_until = None;
                delivery.last_failure = None;
                queries.save_billing_delivery(&delivery)?;
                changed = true;
                Ok(())
            }))
            .context("requeue billing delivery")?;
        Ok(changed)
    }

    fn dead_letters(&self) -> Result<i64> {
        let mut count = 0;
        self.store
            .read(&mut Callback(&mut |queries| {
                count = queries.billing_dead_letter_count()?;
                Ok(())
            }))
            .context("count billing delivery dead letters")?;
        Ok(count)
    }
}
