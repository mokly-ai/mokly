//! Subscription cancellation required before organization deletion.

use std::sync::Arc;

use mkc_billing_interface::error::Error as ProviderError;
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::store::{Callback, Store};

use crate::error::{Error, ErrorResultExt, Result};

/// Provider subscription cancellation observed before the deletion transaction.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cancellation {
    /// Live subscription that Stripe accepted as canceled, when one existed.
    pub provider_subscription_id: Option<String>,
}

/// Provider-independent organization billing lifecycle.
#[unimock::unimock(api = BillingLifecycleMock)]
pub trait BillingLifecycle: Send + Sync {
    /// Cancel a live subscription before its organization is deleted.
    fn cancel_for_deletion(&self, organization: OrganizationId) -> Result<Cancellation>;
}

/// Store-backed lifecycle with an optional configured provider.
pub struct SubscriptionLifecycle {
    /// Shared transactional store.
    pub store: Arc<dyn Store>,
    /// Configured provider; absent billing remains explicit.
    pub provider: Option<Arc<dyn BillingProvider>>,
}

impl BillingLifecycle for SubscriptionLifecycle {
    fn cancel_for_deletion(&self, organization: OrganizationId) -> Result<Cancellation> {
        let mut subscription = None;
        self.store
            .read(&mut Callback(&mut |queries| {
                subscription = queries.billing_subscription(organization)?;
                Ok(())
            }))
            .context("read subscription before organization deletion")?;
        let Some(subscription) = subscription.filter(|value| value.status.is_live()) else {
            return Ok(Cancellation {
                provider_subscription_id: None,
            });
        };
        let provider = self.provider.as_ref().ok_or(Error::OperationUnavailable)?;
        match provider.cancel_subscription(&subscription.provider_subscription_id) {
            Ok(_) | Err(ProviderError::NotFound { .. }) => Ok(Cancellation {
                provider_subscription_id: Some(subscription.provider_subscription_id),
            }),
            Err(source) => Err(Error::ProviderUnavailable { source }),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/lifecycle_tests.rs"]
mod tests;
