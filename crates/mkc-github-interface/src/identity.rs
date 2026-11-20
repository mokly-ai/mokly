//! User-token identity proofs used only during OAuth callbacks.

use serde::Deserialize;

use crate::credentials::Secret;
use crate::error::Result;
use crate::repositories::{Account, Installation};

/// One-use OAuth exchange inputs, deliberately excluded from diagnostics.
pub struct OAuthCode {
    /// Code delivered to the registered redirect URI.
    pub code: String,
    /// Browser-held PKCE verifier.
    pub verifier: String,
}

/// Email verification evidence from the authenticated email-list API.
#[derive(Clone, Debug, Deserialize)]
pub struct Email {
    /// Address to normalize with the cloud's email validator.
    pub email: String,
    /// Whether this is the GitHub user's primary address.
    pub primary: bool,
    /// Whether GitHub has verified ownership.
    pub verified: bool,
}

/// Organization membership role; admin is required for installation linking.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MembershipRole {
    /// Organization owner/administrator.
    Admin,
    /// Ordinary organization membership.
    Member,
}

/// Whether GitHub has activated the membership.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MembershipState {
    /// Accepted membership.
    Active,
    /// Invitation still pending.
    Pending,
}

/// Proof of administration fetched with the user's own credential.
#[derive(Clone, Debug, Deserialize)]
pub struct Membership {
    /// Current role.
    pub role: MembershipRole,
    /// Current membership state.
    pub state: MembershipState,
}

/// OAuth and identity lookup behavior; no credential persistence is implied.
#[unimock::unimock(api = IdentitiesMock)]
pub trait Identities: Send + Sync {
    /// Exchange a code using the configured client secret and redirect URI.
    fn exchange(&self, code: &OAuthCode) -> Result<Secret>;
    /// Fetch the authenticated account's stable numeric identity.
    fn user(&self, token: &Secret) -> Result<Account>;
    /// Fetch all email verification evidence, including private email.
    fn emails(&self, token: &Secret) -> Result<Vec<Email>>;
    /// Fetch installations accessible using the user's credential.
    fn installations(&self, token: &Secret) -> Result<Vec<Installation>>;
    /// Fetch the user's membership of a GitHub organization.
    fn membership(&self, token: &Secret, organization: &str) -> Result<Membership>;
}
