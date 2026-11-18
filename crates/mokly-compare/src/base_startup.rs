//! A base-only preparation can later continue one ordinary classification.

use std::sync::Arc;

use crate::base_render::Changes;
use crate::base_retention::{BaseRetentionRequest, KeptBase};
use crate::error::Result;

/// One prepared attempt that has not compared the head and base.
pub enum PreparedOutcome {
    /// The provider retained the base, so ordinary freshness checks must find it.
    Retained,
    /// The originating attempt owns this captured base without retention.
    Captured(Arc<KeptBase>),
}

/// Prepare and capture a pinned historical base without classification.
pub trait BasePreparation: Send + Sync {
    /// Share the ordinary preparation, capture, failure, and retention policy.
    fn prepare_base(&self, request: &BaseRetentionRequest<'_>) -> Result<PreparedOutcome>;
}

impl BasePreparation for Changes {
    fn prepare_base(&self, request: &BaseRetentionRequest<'_>) -> Result<PreparedOutcome> {
        let attempt = self.prepare_attempt(request)?;
        Ok(match attempt.reuse {
            Some(_) => PreparedOutcome::Retained,
            None => PreparedOutcome::Captured(attempt.base),
        })
    }
}

#[cfg(test)]
#[path = "_tests_/base_startup_tests.rs"]
mod base_startup_tests;

#[cfg(test)]
#[path = "_tests_/base_startup_continuation_tests.rs"]
mod base_startup_continuation_tests;
