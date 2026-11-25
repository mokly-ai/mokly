//! Authentication and command dispatch on a blocking worker.

use std::collections::HashMap;
use std::sync::Arc;

use mkc_auth::service::{Authenticator, Identity};
use mkc_domain::client_origins::ClientOrigin;
use mkc_domain::validation;
use mkc_publications::access::CatalogueAccess;
use mkc_publications::error;
use thiserror::Error;

use crate::action::Action;
use crate::billing::service::BillingService;
use crate::builds::service::BuildsApi;
use crate::endpoints::{self, Endpoint};
use crate::error::{ApiError, Result};
use crate::github::service::GitHubIntegration;
use crate::health::HealthCheck;
use crate::operation::{Operation, OptionalConfiguration};
use crate::pagination::Pagination;
use crate::payload::{Payload, Reply};
use crate::platform::service::Platform;
use crate::publication_views::AccessGrantView;
use crate::viewer::input::Query;
use crate::viewer::service::Viewer;
use crate::views::account::{MagicLinkView, SessionIssuedView};

pub(crate) struct Request {
    pub(crate) operation: Operation,
    pub(crate) params: HashMap<String, String>,
    pub(crate) body: Vec<u8>,
    pub(crate) credential: Option<String>,
    pub(crate) csrf: Option<String>,
    pub(crate) origin: Option<String>,
    pub(crate) peer: String,
    pub(crate) query: String,
    pub(crate) mutating: bool,
    pub(crate) webhook: Option<WebhookHeaders>,
    pub(crate) billing_signature: Option<String>,
}

pub(crate) struct WebhookHeaders {
    pub(crate) delivery_id: String,
    pub(crate) event: String,
    pub(crate) signature: String,
}

/// The public health endpoint is answered before authentication; reaching the
/// authenticated path means the two dispatch stages disagree.
#[derive(Debug, Error)]
#[error("[mkc-api/dispatch] health routed through authentication")]
struct HealthRouting;

#[unimock::unimock(api = [DispatchMock])]
pub(crate) trait Dispatcher: Send + Sync {
    fn dispatch(&self, request: Request) -> Result<Reply>;
}

pub(crate) struct ApiDispatcher {
    pub(crate) health: Arc<dyn HealthCheck>,
    pub(crate) builds: Arc<dyn BuildsApi>,
    pub(crate) viewer: Arc<dyn Viewer>,
    pub(crate) auth: Arc<dyn Authenticator>,
    pub(crate) platform: Arc<dyn Platform>,
    pub(crate) github: Option<Arc<dyn GitHubIntegration>>,
    pub(crate) billing: Option<Arc<dyn BillingService>>,
    pub(crate) access: Arc<dyn CatalogueAccess>,
}

impl Dispatcher for ApiDispatcher {
    fn dispatch(&self, request: Request) -> Result<Reply> {
        if !request.operation.implemented() {
            return Err(ApiError::OperationUnavailable);
        }
        if request.operation.desktop_grant() {
            return self.dispatch_desktop_grant(request);
        }
        if let DispatchTarget::GitHub(github) = self.dispatch_target(request.operation)? {
            return self.dispatch_github(request, github);
        }
        let preview_client = if request.operation == Operation::VerifyPreviewSignIn {
            Some(self.auth.origin(request.origin.as_deref())?)
        } else {
            None
        };
        if request.operation.billing() {
            return self.dispatch_billing(request);
        }
        let endpoint = endpoints::action(
            request.operation,
            &request.params,
            &request.body,
            &request.query,
        )?;
        match endpoint {
            Endpoint::GetHealth => Ok(Reply::ok(Payload::Health(self.health.check()?))),
            Endpoint::SendMagicLink(input) => {
                let client = self.auth.origin(request.origin.as_deref())?;
                let result = self.auth.issue(
                    &input.email,
                    input.return_to.as_deref(),
                    &request.peer,
                    client,
                )?;
                Ok(Reply {
                    status: 202,
                    payload: Payload::MagicLink(MagicLinkView {
                        request_id: result.request_id,
                        resend_after: result.resend_after,
                    }),
                    cookie: None,
                    effects: Vec::new(),
                })
            }
            Endpoint::VerifyMagicLink(input) => {
                let client = self.auth.origin(request.origin.as_deref())?;
                let result = self
                    .auth
                    .verify(&input.token, request.credential.as_deref())?;
                let session = self.platform.session(&result.session.identity)?;
                Ok(Reply {
                    status: 200,
                    payload: Payload::SessionIssued(SessionIssuedView {
                        session,
                        return_to: result.return_to,
                    }),
                    cookie: Some(cookie(&result.session.credential, 2_592_000, client)),
                    effects: Vec::new(),
                })
            }
            Endpoint::VerifyPreviewSignIn(input) => {
                if !(1..=1024).contains(&input.password.len()) {
                    return Err(ApiError::ValidationFailed);
                }
                let result = self.auth.preview(
                    &input.password,
                    request.credential.as_deref(),
                    &request.peer,
                )?;
                let session = self.platform.session(&result.identity)?;
                Ok(Reply {
                    status: 200,
                    payload: Payload::SessionIssued(SessionIssuedView {
                        session,
                        return_to: validation::return_to(input.return_to.as_deref()),
                    }),
                    cookie: Some(cookie(
                        &result.credential,
                        2_592_000,
                        preview_client.ok_or(ApiError::CsrfRejected)?,
                    )),
                    effects: Vec::new(),
                })
            }
            endpoint => self.authenticated(request, endpoint),
        }
    }
}

impl ApiDispatcher {
    /// Select the configured target after the `Operation::implemented()` availability check.
    /// The router registers operations from the Rust-derived OpenAPI document.
    /// This single gate covers preview sign-in and every GitHub operation before
    /// their handlers perform Origin, CSRF, or body validation, so a malformed
    /// request never masks absent configuration.
    fn dispatch_target(&self, operation: Operation) -> Result<DispatchTarget<'_>> {
        match operation.optional_configuration() {
            None => Ok(DispatchTarget::Standard),
            Some(OptionalConfiguration::PreviewSignIn) if self.auth.preview_sign_in_available() => {
                Ok(DispatchTarget::Standard)
            }
            Some(OptionalConfiguration::PreviewSignIn) => Err(ApiError::OperationUnavailable),
            Some(OptionalConfiguration::GitHub) => self
                .github
                .as_deref()
                .map(DispatchTarget::GitHub)
                .ok_or(ApiError::OperationUnavailable),
        }
    }

    fn authenticated(&self, request: Request, endpoint: Endpoint) -> Result<Reply> {
        let identity = match request.credential.as_deref() {
            Some(credential) => Some(self.auth.authenticate(credential)?),
            None if request.operation.anonymous_read() => None,
            None => return Err(ApiError::Unauthenticated),
        };
        let client = if request.mutating {
            self.auth.csrf(
                identity.as_ref().ok_or(ApiError::Unauthenticated)?,
                request.origin.as_deref(),
                request.csrf.as_deref(),
            )?
        } else {
            ClientOrigin::App
        };
        match endpoint {
            Endpoint::GetHealth => Err(ApiError::internal(HealthRouting)),
            Endpoint::CatalogueGrant(project, publication) => {
                let actor = identity.as_ref().ok_or(ApiError::Unauthenticated)?.user.id;
                let grant = match self.access.grant(actor, project, publication) {
                    Ok(grant) => grant,
                    Err(error::Error::Unauthorized) => return Err(ApiError::Unauthenticated),
                    Err(error::Error::Forbidden) => return Err(ApiError::PermissionDenied),
                    Err(error::Error::NotFound) => return Err(ApiError::NotFound),
                    Err(error) => return Err(ApiError::internal(error)),
                };
                Ok(Reply::created(Payload::CatalogueGrant(AccessGrantView {
                    grant: grant.grant,
                    exchange_url: grant.exchange_url,
                })))
            }
            Endpoint::GetSession => Ok(Reply::ok(Payload::Session(
                self.platform
                    .session(identity.as_ref().ok_or(ApiError::Unauthenticated)?)?,
            ))),
            Endpoint::SignOut => {
                self.auth.sign_out(
                    request
                        .credential
                        .as_deref()
                        .ok_or(ApiError::Unauthenticated)?,
                )?;
                Ok(Reply {
                    cookie: Some(cookie("", 0, client)),
                    ..Reply::empty()
                })
            }
            Endpoint::RotateSession => {
                let result = self.auth.rotate(
                    request
                        .credential
                        .as_deref()
                        .ok_or(ApiError::Unauthenticated)?,
                )?;
                let max_age = (result.identity.session.expires_at
                    - result.identity.session.last_seen_at)
                    .num_seconds()
                    .max(0);
                Ok(Reply {
                    status: 200,
                    payload: Payload::Session(self.platform.session(&result.identity)?),
                    cookie: Some(cookie(&result.credential, max_age, client)),
                    effects: Vec::new(),
                })
            }
            Endpoint::Builds(action) => self.builds.execute(
                identity.map(|Identity { user, .. }| user.id),
                action,
                &request.query,
            ),
            Endpoint::Viewer(action) => Ok(self.viewer.execute(
                identity.map(|Identity { user, .. }| user.id),
                action,
                Query::parse(action, &request.query)?,
            )?),
            Endpoint::Platform(action) => {
                let page = if matches!(
                    action,
                    Action::SuggestWorkspaceSlug(_) | Action::SuggestProjectSlug(..)
                ) {
                    Pagination::parse("")?
                } else {
                    Pagination::parse(&request.query)?
                };
                Ok(self.platform.execute(
                    identity.map(|Identity { user, .. }| user.id),
                    action,
                    page,
                )?)
            }
            Endpoint::SendMagicLink(_)
            | Endpoint::VerifyMagicLink(_)
            | Endpoint::VerifyPreviewSignIn(_)
            | Endpoint::DesktopGrant
            | Endpoint::GitHub
            | Endpoint::Billing => Err(ApiError::OperationUnavailable),
        }
    }
}

enum DispatchTarget<'a> {
    Standard,
    GitHub(&'a dyn GitHubIntegration),
}

pub(crate) fn cookie(credential: &str, max_age: i64, client: ClientOrigin) -> String {
    let same_site = match client {
        ClientOrigin::App => "Lax",
        ClientOrigin::Desktop => "None",
    };
    format!(
        "mkc_session={credential}; Path=/; Secure; HttpOnly; SameSite={same_site}; Max-Age={max_age}"
    )
}

#[cfg(test)]
#[path = "_tests_/dispatch_tests.rs"]
mod tests;
