//! One-use desktop sign-in grants, separate from project and upload grants.

use chrono::{DateTime, Utc};
use mkc_domain::ids::UserId;

use crate::error::Result;

/// Persisted desktop credential digest and its browser-authorized binding.
#[derive(Clone, Debug)]
pub struct DesktopGrant {
    /// SHA-256 digest of the random grant. Never the plaintext credential.
    pub token_hash: String,
    /// Base64url S256 challenge of the desktop window's verifier.
    pub challenge: String,
    /// Browser account authorized to sign in on the desktop.
    pub user_id: UserId,
    /// Normalized application destination.
    pub return_to: String,
    /// Exclusive grant deadline, at most five minutes after issue.
    pub expires_at: DateTime<Utc>,
    /// Absolute deadline inherited by the desktop session.
    pub session_expires_at: DateTime<Utc>,
    /// Consumption timestamp retained until diagnostic pruning.
    pub used_at: Option<DateTime<Utc>>,
}

/// Desktop queries used together inside the caller's transaction.
#[unimock::unimock(api = DesktopGrantsMock)]
pub trait DesktopGrants {
    /// Create a fresh grant without replacing an existing digest.
    fn insert_desktop_grant(&mut self, value: &DesktopGrant) -> Result<()>;
    /// Lock a grant until transaction end for constant-time challenge validation.
    fn desktop_grant(&mut self, token_hash: &str) -> Result<Option<DesktopGrant>>;
    /// Consume a locked, challenge-validated grant only if unused and unexpired.
    fn consume_desktop_grant(&mut self, token_hash: &str, now: DateTime<Utc>) -> Result<bool>;
    /// Delete grants at or before the retained expiry cutoff, including used grants.
    fn prune_desktop_grants(&mut self, before: DateTime<Utc>) -> Result<usize>;
}
