//! GitHub route authentication and strict input dispatch.

use mkc_auth::error::Error;
use mkc_auth::service::Identity;
use mkc_domain::ids::InstallationId;

use mkc_store_interface::github_state::FlowPurpose;
use serde::de::DeserializeOwned;

use crate::dispatch::{ApiDispatcher, Request, cookie};
use crate::error::{ApiError, Result};
use crate::github::input::{IncomingDelivery, Install, Start};
use crate::github::listing_input::InstallationsQuery;
use crate::github::service::GitHubIntegration;
use crate::operation::Operation;
use crate::pagination::Pagination;
use crate::payload::{Payload, Reply};
use crate::views::account::SessionIssuedView;

impl ApiDispatcher {
    pub(crate) fn dispatch_github(
        &self,
        request: Request,
        github: &dyn GitHubIntegration,
    ) -> Result<Reply> {
        if request.operation == Operation::ReceiveGitHubWebhook {
            let headers = request.webhook.ok_or(ApiError::ValidationFailed)?;
            github.accept(IncomingDelivery {
                id: headers.delivery_id,
                event: headers.event,
                signature: headers.signature,
                body: request.body,
            })?;
            return Ok(Reply {
                status: 202,
                ..Reply::empty()
            });
        }
        if request.operation == Operation::StartGitHubSignIn {
            self.auth.origin(request.origin.as_deref())?;
            let input: Start = body(&request.body)?;
            return Ok(Reply::ok(Payload::GitHubConnection(github.start(
                None,
                FlowPurpose::SignIn,
                None,
                None,
                input.return_to.as_deref(),
                &request.peer,
            )?)));
        }
        if request.operation == Operation::VerifyGitHubSignIn {
            let client = self.auth.origin(request.origin.as_deref())?;
            let identity = self.optional_github_identity(request.credential.as_deref())?;
            let verified = github.callback(
                identity.as_ref(),
                body(&request.body)?,
                request.credential.as_deref(),
                request.csrf.as_deref(),
            )?;
            let session = self.platform.session(&verified.session.identity)?;
            return Ok(Reply {
                status: 200,
                payload: Payload::SessionIssued(SessionIssuedView {
                    session,
                    return_to: verified.return_to,
                }),
                cookie: Some(cookie(&verified.session.credential, 2_592_000, client)),
                effects: Vec::new(),
            });
        }
        let identity = self.auth.authenticate(
            request
                .credential
                .as_deref()
                .ok_or(ApiError::Unauthenticated)?,
        )?;
        if request.mutating {
            self.auth.csrf(
                &identity,
                request.origin.as_deref(),
                request.csrf.as_deref(),
            )?;
        }
        match request.operation {
            Operation::ConnectGitHub => {
                let input: Start = body(&request.body)?;
                Ok(Reply::ok(Payload::GitHubConnection(github.start(
                    Some(&identity),
                    FlowPurpose::Connect,
                    None,
                    None,
                    input.return_to.as_deref(),
                    &request.peer,
                )?)))
            }
            Operation::InstallGitHubApp => {
                let input: Install = body(&request.body)?;
                Ok(Reply::ok(Payload::GitHubConnection(github.start(
                    Some(&identity),
                    FlowPurpose::Install,
                    Some(input.workspace_id),
                    input.installation_id,
                    input.return_to.as_deref(),
                    &request.peer,
                )?)))
            }
            Operation::CompleteGitHubInstallation => Ok(Reply::ok(Payload::GitHubConnection(
                github.installation_callback(&identity, body(&request.body)?)?,
            ))),
            Operation::DisconnectGitHub => {
                github.disconnect(identity.user.id)?;
                Ok(Reply::empty())
            }
            Operation::DisconnectGitHubInstallation => {
                github.disconnect_installation(identity.user.id, installation(&request)?)?;
                Ok(Reply::empty())
            }
            Operation::ListInstallations => {
                let query = InstallationsQuery::parse(&request.query)?;
                Ok(Reply::ok(Payload::GitHubInstallations(query.page.page(
                    github.installations(identity.user.id, query.workspace_id)?,
                    |value| value.id.0,
                ))))
            }
            Operation::ListRepositories => {
                let page = Pagination::parse(&request.query)?;
                Ok(Reply::ok(Payload::GitHubRepositories(page.page(
                    github.repositories(identity.user.id, installation(&request)?)?,
                    |value| value.id.0,
                ))))
            }
            _ => Err(ApiError::OperationUnavailable),
        }
    }

    fn optional_github_identity(&self, credential: Option<&str>) -> Result<Option<Identity>> {
        match credential.map(|credential| self.auth.authenticate(credential)) {
            Some(Ok(identity)) => Ok(Some(identity)),
            None | Some(Err(Error::Unauthenticated | Error::SessionExpired)) => Ok(None),
            Some(Err(error)) => Err(ApiError::from(error)),
        }
    }
}

fn body<T: DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    match serde_json::from_slice(bytes) {
        Ok(value) => Ok(value),
        Err(_) => Err(ApiError::ValidationFailed),
    }
}

fn installation(request: &Request) -> Result<InstallationId> {
    request
        .params
        .get("installationId")
        .and_then(|value| value.parse().ok())
        .map(InstallationId)
        .ok_or(ApiError::ValidationFailed)
}
