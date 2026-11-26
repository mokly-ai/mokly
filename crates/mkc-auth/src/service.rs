//! Authentication service consumed through a shared trait object.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_domain::client_origins::{AdmittedOrigins, ClientOrigin};
use mkc_email_interface::mail::Mailer;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::Store;
use mkc_store_interface::user::User;
use uuid::Uuid;

use crate::error::Result;
use crate::preview_verifier::PreviewVerifier;
use crate::runtime::Runtime;

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

/// Verify one admitted preview password on a blocking worker.
pub type PreviewPasswordCheck = Box<dyn FnOnce(&str) -> Result<PreviewSessionIssue> + Send>;

/// Issue a session on a blocking worker after the preview password matches.
pub type PreviewSessionIssue = Box<dyn FnOnce() -> Result<SessionIssued> + Send>;

/// One-use sign-in exchange result with its validated navigation destination.
pub struct LinkVerified {
    /// Issued session and credential.
    pub session: SessionIssued,
    /// Validated application destination.
    pub return_to: String,
}

/// One-use desktop credential delivered only to the issuing browser.
pub struct DesktopGrantIssued {
    /// Random grant returned once, never stored in plaintext.
    pub grant: String,
    /// Exclusive grant deadline.
    pub expires_at: DateTime<Utc>,
}

/// Normalized preview account identity and its optional password verifier.
pub struct PreviewSignIn {
    /// Optional verifier for the account's password.
    pub(crate) verifier: Option<PreviewVerifier>,
    /// Normalized account identity.
    pub(crate) email: String,
}

impl PreviewSignIn {
    /// Prepare the shared account from validated configuration.
    pub fn new(email: String, verifier: Option<PreviewVerifier>) -> Self {
        Self { verifier, email }
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
    /// Report whether the shared preview account has validated runtime configuration.
    fn preview_sign_in_available(&self) -> bool;
    /// Report the configured account email when a preview password verifier is present.
    fn preview_password_account(&self) -> Option<&str>;
    /// Find or create the configured preview account without issuing a session.
    fn preview_account(&self) -> Result<User>;
    /// Commit peer admission and return the work for one password check.
    fn preview(
        self: Arc<Self>,
        previous: Option<String>,
        peer: &str,
    ) -> Result<PreviewPasswordCheck>;
    /// Authorize a desktop window from an authenticated browser session.
    fn issue_desktop_grant(
        &self,
        identity: &Identity,
        challenge: &str,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<DesktopGrantIssued>;
    /// Consume a desktop grant and replace the supplied session atomically.
    fn exchange_desktop_grant(
        &self,
        grant: &str,
        verifier: &str,
        previous: Option<&str>,
        peer: &str,
    ) -> Result<LinkVerified>;
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
