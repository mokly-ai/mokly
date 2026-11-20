//! Stable GitHub user associations and one-use OAuth flow storage.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{OrganizationId, UserId};

use crate::error::Result;
use crate::github_state::FlowPurpose;

/// One stable GitHub account linked to one verified Mokly user.
#[derive(Clone, Debug)]
pub struct GitHubIdentity {
    /// GitHub user ID, independent of mutable email/login.
    pub github_user_id: i64,
    /// Mokly user whose verified identity owns the link.
    pub user_id: UserId,
    /// Current GitHub display/login name.
    pub login: String,
    /// Initial link creation time.
    pub created_at: DateTime<Utc>,
}

/// Hashed OAuth state and verifier with session-bound purpose.
#[derive(Clone, Debug)]
pub struct OAuthFlow {
    /// SHA-256 digest of random OAuth state.
    pub state_hash: String,
    /// SHA-256 digest of browser-held PKCE verifier.
    pub verifier_hash: String,
    /// Requested account or installation operation.
    pub purpose: FlowPurpose,
    /// Initiating authenticated user, if any.
    pub user_id: Option<UserId>,
    /// Hash of the initiating session credential.
    pub session_hash: Option<String>,
    /// Organization for an installation flow.
    pub organization_id: Option<OrganizationId>,
    /// Untrusted installation candidate, verified using OAuth later.
    pub installation_id: Option<i64>,
    /// Validated relative application destination.
    pub return_to: String,
    /// Exclusive expiry deadline.
    pub expires_at: DateTime<Utc>,
    /// Consumption time, retained to reject replays.
    pub used_at: Option<DateTime<Utc>>,
}

/// GitHub identity and OAuth queries; secrets never enter the database.
#[unimock::unimock(api = GitHubIdentitiesMock)]
pub trait GitHubIdentities {
    /// Find a stable GitHub identity.
    fn github_identity(&mut self, github_user: i64) -> Result<Option<GitHubIdentity>>;
    /// Find a cloud user's GitHub association.
    fn user_github_identity(&mut self, user: UserId) -> Result<Option<GitHubIdentity>>;
    /// Insert or update the identity after policy checks.
    fn save_github_identity(&mut self, value: &GitHubIdentity) -> Result<()>;
    /// Remove a user's provider identity.
    fn delete_github_identity(&mut self, user: UserId) -> Result<()>;
    /// Read a hashed OAuth state.
    fn github_oauth_flow(&mut self, hash: &str) -> Result<Option<OAuthFlow>>;
    /// Insert or update a flow in the enclosing transaction.
    fn save_github_oauth_flow(&mut self, value: &OAuthFlow) -> Result<()>;
}
