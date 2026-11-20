//! Typed entitlement refusals and preserved persistence failures.

use std::result;

use internal_error::InternalError;
use mkc_domain::values::Plan;
use thiserror::Error;

use mkc_billing_interface::error::Error as ProviderError;

/// A plan-gated product capability.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Feature {
    /// Private projects and publications.
    PrivateProjects,
}

impl Feature {
    /// Stable API spelling for plan refusal data.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PrivateProjects => "private-projects",
        }
    }
}

/// Outcomes callers explicitly translate at their transport boundary.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// The organization does not exist.
    #[error("[mkc-billing/error] organization not found")]
    NotFound,
    /// The current plan does not include the requested feature.
    #[error("[mkc-billing/error] {required:?} plan required for {feature:?}")]
    PlanRequired {
        /// Lowest plan that includes the feature.
        required: Plan,
        /// Refused plan-gated capability.
        feature: Feature,
    },
    /// Billing configuration is required to finish the operation safely.
    #[error("[mkc-billing/error] billing operation unavailable")]
    OperationUnavailable,
    /// A provider failure prevented a lifecycle operation.
    #[error("[mkc-billing/error] billing provider unavailable: {source}")]
    ProviderUnavailable {
        /// Typed provider failure retained for server diagnostics.
        #[source]
        source: ProviderError,
    },
    /// Preserved persistence failure, safe only for server diagnostics.
    #[error("[mkc-billing/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Result of entitlement evaluation.
pub type Result<T> = result::Result<T, Error>;
