//! Narrow check-run contract shared with publication delivery.

use std::result;

use internal_error::InternalError;
use mkc_domain::ids::ProjectId;
use thiserror::Error;

use crate::checks::Status;

/// Provider delivery failures never change the publication's ingest outcome.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// A provider HTTP rejection, including its rate-limit classification.
    #[error("[mkc-github-interface/check] HTTP {status}, rate limited: {rate_limited}")]
    Http {
        /// HTTP response status from the provider.
        status: u16,
        /// Provider-confirmed primary or secondary rate limiting, including 403.
        rate_limited: bool,
    },
    /// The adapter rejected an invalid check before making a provider request.
    #[error("[mkc-github-interface/check] invalid check update")]
    Validation,
    /// Preserved provider/authentication/transport failure.
    #[error("[mkc-github-interface/check] internal: {0:?}")]
    Internal(#[from] InternalError),
}

impl Error {
    /// Only non-transient client responses and validation consume a dead-letter budget.
    pub fn is_permanent(&self) -> bool {
        match self {
            Self::Http {
                status,
                rate_limited,
            } => !rate_limited && (400..500).contains(status) && !matches!(status, 408 | 429),
            Self::Validation => true,
            Self::Internal(_) => false,
        }
    }
}

/// Result of a provider check update.
pub type Result<T> = result::Result<T, Error>;

/// Completed check conclusion.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Conclusion {
    /// Valid published comparison, including zero changes.
    Success,
    /// Current-only or expired catalogue.
    Neutral,
    /// Invalid ingest with an authorized immutable head identity.
    Failure,
    /// Publishing was cancelled or replaced.
    Cancelled,
}

/// Complete idempotent check update, with provider-independent values.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CheckRun {
    /// Project whose installation authorizes provider delivery.
    pub project_id: ProjectId,
    /// Publication repository identity; delivery resolves the current binding.
    pub repository: String,
    /// Actual publication head SHA.
    pub head_sha: String,
    /// Stable publication or build external ID, used for reconcile/upsert.
    pub external_id: String,
    /// Check name; the publication worker uses `Mokly`.
    pub name: String,
    /// Current lifecycle state.
    pub status: Status,
    /// Present exactly when status is completed.
    pub conclusion: Option<Conclusion>,
    /// Concise user-facing output title.
    pub title: String,
    /// Markdown summary with bounded entry links.
    pub summary: String,
    /// Canonical app Changes destination.
    pub details_url: String,
}

/// Idempotent delivery through the project's connected GitHub installation.
#[unimock::unimock(api = CheckRunsMock)]
pub trait CheckRuns: Send + Sync {
    /// Reconcile one check by repository, head and external ID; repeated calls
    /// update the same check even after a lost response or worker crash.
    fn upsert(&self, check: &CheckRun) -> Result<()>;
}

#[cfg(test)]
#[path = "_tests_/check_tests.rs"]
mod tests;
