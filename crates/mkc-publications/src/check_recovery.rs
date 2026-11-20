//! Operator recovery independent of any existing provider check or credentials.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use uuid::Uuid;

use crate::error::{ErrorResultExt, Result};
use crate::transaction::Transactions;

/// Trusted operator maintenance; never exposed to anonymous HTTP callers.
#[unimock::unimock(api = CheckRecoveryMock)]
pub trait CheckRecovery: Send + Sync {
    /// Read the current undelivered dead-letter count without loading providers.
    fn dead_letters(&self) -> Result<i64>;
    /// Requeue one undelivered dead letter, or return false for an ineligible ID.
    fn requeue(&self, event: Uuid) -> Result<bool>;
}

/// Recovery needs only the store and clock, not the provider or catalogue files.
pub struct PublicationCheckRecovery {
    /// Transactional outbox queries.
    pub transactions: Arc<dyn Transactions>,
    /// Current next-attempt timestamp.
    pub runtime: Arc<dyn Runtime>,
}

impl CheckRecovery for PublicationCheckRecovery {
    fn dead_letters(&self) -> Result<i64> {
        let mut count = 0;
        self.transactions.run(true, &mut |queries| {
            count = queries
                .dead_letter_count()
                .context("read dead-letter alert count")?;
            count += queries
                .build_check_dead_letter_count()
                .context("read build check dead letters")?;
            Ok(())
        })?;
        Ok(count)
    }

    fn requeue(&self, event: Uuid) -> Result<bool> {
        let now = self.runtime.now();
        let mut changed = false;
        self.transactions.run(false, &mut |queries| {
            changed = queries
                .requeue_publication_event(event, now)
                .context("recover dead publication check")?;
            Ok(())
        })?;
        Ok(changed)
    }
}
