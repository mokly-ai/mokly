//! Billing-service outcomes translated at the single HTTP error boundary.

use std::result;

use internal_error::InternalError;
use mkc_billing_interface::error::Error as ProviderError;
use thiserror::Error;

use crate::error::ApiError;

/// Billing API policy, provider, and persistence outcomes.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub(crate) enum Error {
    /// The workspace or membership is inaccessible.
    #[error("[mkc-api/billing/error] not found")]
    NotFound,
    /// The actor's workspace role cannot perform the operation.
    #[error("[mkc-api/billing/error] permission denied")]
    Forbidden,
    /// Checkout cannot create a second live subscription.
    #[error("[mkc-api/billing/error] subscription active")]
    SubscriptionActive,
    /// Billing is configured but Checkout cannot safely use both prices.
    #[error("[mkc-api/billing/error] operation unavailable")]
    OperationUnavailable,
    /// A provider rate limit supplies the minimum retry delay.
    #[error("[mkc-api/billing/error] provider rate limited for {0} seconds")]
    RateLimited(i64),
    /// A retryable provider outage prevented the operation.
    #[error("[mkc-api/billing/error] provider unavailable: {source}")]
    ProviderUnavailable {
        /// Typed provider failure retained for diagnostics.
        #[source]
        source: ProviderError,
    },
    /// Request bytes or provider data violated the public contract.
    #[error("[mkc-api/billing/error] validation failed")]
    ValidationFailed,
    /// The Stripe webhook signature did not authenticate the original bytes.
    #[error("[mkc-api/billing/error] webhook signature invalid")]
    WebhookSignatureInvalid,
    /// Unhandled persistence, provider, serialization, or runtime failure.
    #[error("[mkc-api/billing/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

pub(crate) type Result<T> = result::Result<T, Error>;

impl Error {
    #[track_caller]
    pub(super) fn from_provider(error: ProviderError) -> Self {
        match error {
            ProviderError::RateLimited { retry_after, .. } => {
                Self::RateLimited(i64::try_from(retry_after).unwrap_or(i64::MAX))
            }
            source @ ProviderError::Unavailable => Self::ProviderUnavailable { source },
            source @ (ProviderError::InvalidRequest { .. }
            | ProviderError::Unauthorized { .. }
            | ProviderError::PermissionDenied { .. }
            | ProviderError::NotFound { .. }
            | ProviderError::Internal(_)) => Self::internal(source),
        }
    }
}

impl From<Error> for ApiError {
    fn from(value: Error) -> Self {
        match value {
            Error::NotFound => Self::NotFound,
            Error::Forbidden => Self::PermissionDenied,
            Error::SubscriptionActive => Self::SubscriptionActive,
            Error::OperationUnavailable => Self::OperationUnavailable,
            Error::RateLimited(delay) => Self::RateLimited(delay),
            Error::ProviderUnavailable { .. } => Self::Unavailable,
            Error::ValidationFailed => Self::ValidationFailed,
            Error::WebhookSignatureInvalid => Self::WEBHOOK_SIGNATURE_INVALID,
            Error::Internal(source) => Self::Internal(source),
        }
    }
}
