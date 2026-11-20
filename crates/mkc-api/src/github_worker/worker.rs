//! Recoverable delivery leases and bounded retry scheduling in the API process.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::Runtime;
use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_state::{DeliveryStatus, Failure};
use mkc_store_interface::store::{Callback, Store};

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::github::transaction::Work;

use super::apply::PreparedEvent;
use super::handlers::EventHandler;

#[unimock::unimock(api = DeliveryWorkerMock)]
pub(crate) trait DeliveryWorker: Send + Sync {
    fn run_once(&self) -> Result<bool>;
}

pub(crate) struct GitHubWorker {
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
    pub(crate) handler: Arc<dyn EventHandler>,
}

impl DeliveryWorker for GitHubWorker {
    fn run_once(&self) -> Result<bool> {
        let now = self.runtime.now();
        let lease = self.runtime.id();
        let mut delivery = None;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                queries.expire_github_deliveries(now)?;
                delivery = queries.claim_github_delivery(now, lease, now + Duration::minutes(5))?;
                Ok(())
            }))
            .context("claim next GitHub delivery")?;
        let Some(delivery) = delivery else {
            return Ok(false);
        };
        let result = self.handler.prepare(&delivery).and_then(|prepared| {
            let event: &dyn PreparedEvent = &prepared;
            let mut operation = |queries: &mut dyn mkc_store_interface::store::Queries| {
                let Some(mut current) = queries
                    .github_delivery(delivery.id)
                    .context("read delivery completion fence")?
                else {
                    return Ok(());
                };
                if current.lease != Some(lease) || current.status != DeliveryStatus::Processing {
                    return Ok(());
                }
                current.status = event.apply(queries)?;
                current.lease = None;
                current.lease_until = None;
                current.last_failure = None;
                queries
                    .save_github_delivery(&current)
                    .context("complete GitHub delivery")?;
                Ok(())
            };
            let mut work = Work {
                operation: &mut operation,
                rejected: None,
            };
            self.store
                .transaction(&mut work)
                .context("commit GitHub handler effects")?;
            match work.rejected {
                Some(error) => Err(error),
                None => Ok(()),
            }
        });
        if let Err(error) = result {
            tracing::warn!(delivery_id = %delivery.id, attempts = delivery.attempts, "GitHub delivery will be retried or retained");
            self.failed(&delivery, &error)?;
        }
        Ok(true)
    }
}

impl GitHubWorker {
    fn failed(&self, delivery: &Delivery, error: &ApiError) -> Result<()> {
        let now = self.runtime.now();
        let (category, provider_delay, terminal) = match error {
            ApiError::ValidationFailed => (Failure::Malformed, 0, true),
            ApiError::PermissionDenied | ApiError::NotFound => (Failure::Forbidden, 0, false),
            ApiError::Unavailable => (Failure::Unavailable, 0, false),
            ApiError::RateLimited(delay) => (Failure::RateLimited, *delay, false),
            _ => (Failure::Internal, 0, false),
        };
        let delay = (5_i64 << (delivery.attempts - 1).clamp(0, 6)).max(provider_delay);
        let due = Duration::try_seconds(delay)
            .and_then(|delay| now.checked_add_signed(delay))
            .unwrap_or(DateTime::<Utc>::MAX_UTC);
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let Some(mut current) = queries.github_delivery(delivery.id)? else {
                    return Ok(());
                };
                if current.lease != delivery.lease || current.status != DeliveryStatus::Processing {
                    return Ok(());
                }
                current.status = if terminal || current.attempts >= 8 {
                    DeliveryStatus::Failed
                } else {
                    DeliveryStatus::Pending
                };
                current.lease = None;
                current.lease_until = None;
                current.last_failure = Some(category);
                current.due_at = due;
                queries.save_github_delivery(&current)
            }))
            .context("persist GitHub delivery failure")
    }
}

#[cfg(test)]
#[path = "_tests_/worker_tests.rs"]
mod worker_tests;
