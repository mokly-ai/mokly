//! Authentication and command dispatch, with an async handoff for preview sign-in.

use std::collections::HashMap;
use std::sync::Arc;

use mkc_auth::service::{Authenticator, Identity};
use mkc_domain::client_origins::ClientOrigin;
use mkc_publications::access::CatalogueAccess;
use mkc_publications::error;
use thiserror::Error;

use crate::action::Action;
use crate::billing::service::BillingService;
use crate::builds::service::BuildsApi;
use crate::configuration::DispatchTarget;
use crate::endpoints::{self, Endpoint};
use crate::error::{ApiError, Result};
use crate::github::service::GitHubIntegration;
use crate::health::HealthCheck;
use crate::operation::Operation;
use crate::pagination::Pagination;
use crate::payload::{Payload, Reply};
use crate::platform::service::Platform;
use crate::preview_dispatch::{AdmittedPreview, PreviewHashSlots};
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

/// The health and configuration endpoints are answered before authentication.
#[derive(Debug, Error)]
#[error("[mkc-api/dispatch] public read routed through authentication")]
struct PublicReadRouting;

#[unimock::unimock(api = [DispatchMock])]
pub(crate) trait Dispatcher: Send + Sync {
    fn dispatch(&self, request: Request) -> Result<DispatchOutcome>;
}

/// The result of the first blocking phase of API dispatch.
#[expect(
    clippy::large_enum_variant,
    reason = "Ordinary requests usually return a reply, which fits inline without a new allocation."
)]
pub(crate) enum DispatchOutcome {
    /// A response ready to send.
    Reply(Reply),
    /// An admitted password exchange that needs a hash permit.
    Preview(AdmittedPreview),
}

impl DispatchOutcome {
    pub(crate) async fn finish(self) -> Result<Reply> {
        match self {
            Self::Reply(reply) => Ok(reply),
            Self::Preview(preview) => preview.finish().await,
        }
    }
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
    pub(crate) preview_hash_slots: PreviewHashSlots,
}

impl Dispatcher for ApiDispatcher {
    fn dispatch(&self, request: Request) -> Result<DispatchOutcome> {
        if !request.operation.implemented() {
            return Err(ApiError::OperationUnavailable);
        }
        if request.operation.desktop_grant() {
            return self
                .dispatch_desktop_grant(request)
                .map(DispatchOutcome::Reply);
        }
        match self.dispatch_target(request.operation.optional_configuration())? {
            DispatchTarget::GitHub(github) => {
                return self
                    .dispatch_github(request, github)
                    .map(DispatchOutcome::Reply);
            }
            DispatchTarget::Billing(billing) => {
                return self
                    .dispatch_billing(request, billing)
                    .map(DispatchOutcome::Reply);
            }
            DispatchTarget::Standard => {}
        }
        let preview_client = if request.operation == Operation::VerifyPreviewSignIn {
            Some(self.auth.origin(request.origin.as_deref())?)
        } else {
            None
        };
        let endpoint = endpoints::action(
            request.operation,
            &request.params,
            &request.body,
            &request.query,
        )?;
        let reply = match endpoint {
            Endpoint::VerifyPreviewSignIn(input) => {
                let client = preview_client.ok_or(ApiError::CsrfRejected)?;
                return self
                    .admit_preview(request, client, input)
                    .map(DispatchOutcome::Preview);
            }
            Endpoint::GetHealth => Ok(Reply::ok(Payload::Health(self.health.check()?))),
            Endpoint::GetConfiguration => {
                Ok(Reply::ok(Payload::Configuration(self.configuration())))
            }
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
            endpoint => self.authenticated(request, endpoint),
        }?;
        Ok(DispatchOutcome::Reply(reply))
    }
}

impl ApiDispatcher {
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
            Endpoint::GetHealth | Endpoint::GetConfiguration => {
                Err(ApiError::internal(PublicReadRouting))
            }
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
