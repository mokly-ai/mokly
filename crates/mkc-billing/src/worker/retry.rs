//! Delivery attempt classification and retry timing.

use chrono::{DateTime, Utc};
use mkc_billing_interface::error::Error as ProviderError;
use mkc_store_interface::billing_state::BillingFailure;
use mkc_store_interface::error::Error as StoreError;
use thiserror::Error;

use crate::retry::retry_deadline;

#[derive(Debug, Error)]
pub(super) enum AttemptError {
    #[error("[mkc-billing/worker] malformed known event")]
    Malformed,
    #[error("[mkc-billing/worker] conflicting live subscription")]
    Conflict,
    #[error("[mkc-billing/worker] provider failure: {0}")]
    Provider(ProviderError),
    #[error("[mkc-billing/worker] store failure: {0}")]
    Store(StoreError),
}

pub(super) struct Policy {
    pub(super) category: BillingFailure,
    pub(super) retry_after: u64,
    pub(super) terminal: bool,
}

impl AttemptError {
    pub(super) fn policy(&self) -> Policy {
        match self {
            Self::Malformed => Policy {
                category: BillingFailure::Malformed,
                retry_after: 0,
                terminal: true,
            },
            Self::Conflict => Policy {
                category: BillingFailure::Conflict,
                retry_after: 0,
                terminal: true,
            },
            Self::Provider(ProviderError::Unavailable) => Policy {
                category: BillingFailure::Unavailable,
                retry_after: 0,
                terminal: false,
            },
            Self::Provider(ProviderError::RateLimited { retry_after, .. }) => Policy {
                category: BillingFailure::RateLimited,
                retry_after: *retry_after,
                terminal: false,
            },
            Self::Provider(ProviderError::Internal(_)) | Self::Store(_) => Policy {
                category: BillingFailure::Internal,
                retry_after: 0,
                terminal: false,
            },
            Self::Provider(
                ProviderError::InvalidRequest { .. }
                | ProviderError::Unauthorized { .. }
                | ProviderError::PermissionDenied { .. }
                | ProviderError::NotFound { .. },
            ) => Policy {
                category: BillingFailure::Internal,
                retry_after: 0,
                terminal: true,
            },
        }
    }
}

pub(super) fn due_at(now: DateTime<Utc>, attempts: i32, provider_delay: u64) -> DateTime<Utc> {
    let exponent = (attempts - 1).clamp(0, 6);
    let delay = (5_u64 << exponent).max(provider_delay);
    retry_deadline(now, delay)
}
