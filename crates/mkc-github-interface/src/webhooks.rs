//! Verification boundary for raw GitHub webhook signatures.

use crate::error::Result;

/// Authentication over original request bytes, before JSON decoding.
#[unimock::unimock(api = WebhookVerifierMock)]
pub trait WebhookVerifier: Send + Sync {
    /// Verify the complete sha256-prefixed header using constant-time MAC verification.
    fn verify(&self, signature: &str, body: &[u8]) -> Result<bool>;
}
