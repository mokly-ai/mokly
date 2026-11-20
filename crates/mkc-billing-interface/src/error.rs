//! Stable billing-provider outcomes that callers can handle explicitly.

use std::fmt::{self, Display, Formatter};
use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Whether a provider request was definitely refused or may have taken effect.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RequestOutcome {
    /// The provider definitely rejected the request before it took effect.
    Rejected,
    /// The caller cannot know whether the provider accepted the request.
    Unknown,
}

/// Provider error categories retained from a sanitized Stripe refusal.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProviderErrorType {
    /// Stripe could not complete an otherwise valid API request.
    ApiError,
    /// Stripe refused a card-related request.
    CardError,
    /// Stripe rejected idempotency-key reuse or parameters.
    IdempotencyError,
    /// Stripe rejected request parameters or state.
    InvalidRequestError,
    /// Stripe returned a type newer than the pinned provider contract.
    Unknown,
}

impl ProviderErrorType {
    /// Classify a Stripe error-type string without retaining the original value.
    pub fn from_provider(value: &str) -> Self {
        match value {
            "api_error" => Self::ApiError,
            "card_error" => Self::CardError,
            "idempotency_error" => Self::IdempotencyError,
            "invalid_request_error" => Self::InvalidRequestError,
            _ => Self::Unknown,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::ApiError => "api_error",
            Self::CardError => "card_error",
            Self::IdempotencyError => "idempotency_error",
            Self::InvalidRequestError => "invalid_request_error",
            Self::Unknown => "unknown",
        }
    }
}

/// Sanitized provider error code with a bounded lowercase token grammar.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProviderErrorCode(String);

impl ProviderErrorCode {
    /// Retain a provider code only when it matches `^[a-z0-9_]{1,64}$`.
    pub fn new(value: String) -> Option<Self> {
        (!value.is_empty()
            && value.len() <= 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'))
        .then_some(Self(value))
    }

    /// Borrow the validated provider code.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Sanitized actionable context attached to a definite provider refusal.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ProviderDetail {
    /// Known provider error category, or `None` when absent or undecodable.
    pub error_type: Option<ProviderErrorType>,
    /// Validated provider error code, or `None` when absent or unsafe.
    pub code: Option<ProviderErrorCode>,
}

impl ProviderDetail {
    /// Build an empty detail for refusals constructed outside a provider response.
    pub fn none() -> Self {
        Self::default()
    }
}

impl Display for ProviderDetail {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        let error_type = self.error_type.map_or("none", ProviderErrorType::as_str);
        let code = self.code.as_ref().map_or("none", ProviderErrorCode::as_str);
        write!(formatter, "type={error_type} code={code}")
    }
}

/// Billing-provider failures; unhandled details remain in the internal source chain.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// The caller supplied an invalid provider request.
    #[error("[mkc-billing-interface/error] invalid request: {detail}")]
    InvalidRequest {
        /// Sanitized provider refusal detail.
        detail: ProviderDetail,
    },
    /// The configured provider credential was rejected.
    #[error("[mkc-billing-interface/error] unauthorized: {detail}")]
    Unauthorized {
        /// Sanitized provider refusal detail.
        detail: ProviderDetail,
    },
    /// The configured provider credential lacks permission for the request.
    #[error("[mkc-billing-interface/error] permission denied: {detail}")]
    PermissionDenied {
        /// Sanitized provider refusal detail.
        detail: ProviderDetail,
    },
    /// The requested provider resource is absent or inaccessible.
    #[error("[mkc-billing-interface/error] not found: {detail}")]
    NotFound {
        /// Sanitized provider refusal detail.
        detail: ProviderDetail,
    },
    /// The provider rejected admission; honor this minimum delay.
    #[error("[mkc-billing-interface/error] rate limited for {retry_after} seconds: {detail}")]
    RateLimited {
        /// Positive seconds before retrying.
        retry_after: u64,
        /// Sanitized provider refusal detail.
        detail: ProviderDetail,
    },
    /// A transient provider outage permits a later retry.
    #[error("[mkc-billing-interface/error] unavailable")]
    Unavailable,
    /// An unhandled provider, transport, verification, or serialization failure.
    #[error("[mkc-billing-interface/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

impl Error {
    /// Construct a local invalid-request refusal without provider detail.
    pub fn invalid_request() -> Self {
        Self::InvalidRequest {
            detail: ProviderDetail::none(),
        }
    }

    /// Classify whether retrying with a new idempotency key is safe.
    pub fn request_outcome(&self) -> RequestOutcome {
        match self {
            Self::InvalidRequest { .. }
            | Self::Unauthorized { .. }
            | Self::PermissionDenied { .. }
            | Self::NotFound { .. }
            | Self::RateLimited { .. } => RequestOutcome::Rejected,
            Self::Unavailable | Self::Internal(_) => RequestOutcome::Unknown,
        }
    }
}

/// Result returned by billing-provider traits.
pub type Result<T> = result::Result<T, Error>;

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod error_tests;
