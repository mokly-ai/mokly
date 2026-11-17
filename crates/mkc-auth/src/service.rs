//! Authentication service consumed through a shared trait object.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_email_interface::mail::Mailer;
use mkc_domain::client_origins::{AdmittedOrigins, ClientOrigin};
use mkc_store_interface::session::Session;
use mkc_store_interface::store::Store;
use mkc_store_interface::user::User;
use uuid::Uuid;

use crate::error::Result;
use crate::runtime::{Runtime, hash};

/// Public acknowledgement, identical for existing and new accounts.
pub struct LinkIssued {
    /// Correlation identifier, not a credential.
    pub request_id: Uuid,
    /// Earliest next email request time.
    pub resend_after: DateTime<Utc>,
}

/// Authenticated session and verified user.
#[derive(Clone, Debug)]
pub struct Identity {
    /// Internal session record; do not serialize the hash.
    pub session: Session,
    /// Verified user record.
    pub user: User,
}

/// Session issuance result, delivered as an HttpOnly cookie by the API.
pub struct SessionIssued {
    /// Session and user identity.
    pub identity: Identity,
    /// Credential for the one cookie-setting response.
    pub credential: String,
}

/// Magic-link exchange result with its validated navigation destination.
pub struct LinkVerified {
    /// Issued session and credential.
    pub session: SessionIssued,
    /// Validated application destination.
    pub return_to: String,
}

/// Hashed preview credential and normalized account identity.
pub struct PreviewSignIn {
    /// Digest retained for constant-time comparison.
    pub(crate) secret_hash: String,
    /// Normalized account identity.
    pub(crate) email: String,
}

impl PreviewSignIn {
    /// Prepare validated configuration without retaining the plaintext credential.
    pub fn new(secret: &str, email: String) -> Self {
        Self {
            secret_hash: hash(secret),
            email,
        }
    }
}

/// Authentication behavior, synchronous on a blocking worker.
#[unimock::unimock(api = AuthenticatorMock)]
pub trait Authenticator: Send + Sync {
    /// Rate-limit and deliver a single-use link.
    fn issue(
        &self,
        email: &str,
        return_to: Option<&str>,
        peer: &str,
        client: ClientOrigin,
    ) -> Result<LinkIssued>;
    /// Consume a link and atomically issue the session.
    fn verify(&self, token: &str, previous: Option<&str>) -> Result<LinkVerified>;
    /// Report whether preview sign-in has validated runtime configuration.
    fn preview_sign_in_available(&self) -> bool;
    /// Find or create the configured preview account without issuing a session.
    fn preview_account(&self) -> Result<User>;
    /// Admit and verify a configured preview credential, then issue a session.
    fn preview(&self, secret: &str, previous: Option<&str>, peer: &str) -> Result<SessionIssued>;
    /// Authenticate, enforce idle/absolute expiry, and update activity.
    fn authenticate(&self, credential: &str) -> Result<Identity>;
    /// Rotate the session and CSRF token, preserving absolute expiry.
    fn rotate(&self, credential: &str) -> Result<SessionIssued>;
    /// Revoke a session immediately.
    fn sign_out(&self, credential: &str) -> Result<()>;
    /// Validate both Origin and a session-bound anti-CSRF token.
    fn csrf(
        &self,
        identity: &Identity,
        origin: Option<&str>,
        token: Option<&str>,
    ) -> Result<ClientOrigin>;
    /// Validate and classify Origin on unauthenticated requests.
    fn origin(&self, origin: Option<&str>) -> Result<ClientOrigin>;
}

/// Policy implementation with all impure collaborators injected.
pub struct AuthService {
    /// Serializable database boundary.
    pub store: Arc<dyn Store>,
    /// Delivery boundary.
    pub mailer: Arc<dyn Mailer>,
    /// Clock and entropy source.
    pub runtime: Arc<dyn Runtime>,
    /// Shared exact-origin policy used for admission and public link construction.
    pub origins: AdmittedOrigins,
    /// Optional capability-gated preview sign-in configuration.
    pub preview_sign_in: Option<PreviewSignIn>,
}
