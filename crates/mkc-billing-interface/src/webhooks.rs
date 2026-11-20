//! Verification boundary for raw Stripe webhook signatures.

use chrono::{DateTime, Utc};

use crate::error::Result;

/// Result of parsing, freshness checking, and authenticating a signature header.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verification {
    /// The timestamp is current and at least one `v1` signature matches.
    Valid,
    /// The header does not follow the required grammar.
    Malformed,
    /// The timestamp differs from current time by more than five minutes.
    Stale,
    /// The header is well formed and current but no `v1` signature matches.
    Mismatch,
}

/// Authentication over original request bytes before event decoding.
///
/// The grammar is comma-separated `k=v` pairs containing one numeric `t`
/// Unix timestamp and one or more 64-hex-character `v1` signatures. Other
/// signature schemes are ignored. A timestamp within five minutes is current,
/// and any matching `v1` value is sufficient during secret rotation.
#[unimock::unimock(api = WebhookVerifierMock)]
pub trait WebhookVerifier: Send + Sync {
    /// Verify a complete `Stripe-Signature` header against the raw body.
    fn verify(
        &self,
        signature_header: &str,
        body: &[u8],
        now: DateTime<Utc>,
    ) -> Result<Verification>;
}
