//! Desktop grant authentication, browser binding and body validation precedence.

use crate::desktop_grant_input::{DesktopGrantCallback, DesktopGrantRequest};
use crate::dispatch::{ApiDispatcher, Request, cookie};
use crate::endpoints::body;
use crate::error::{ApiError, Result};
use crate::operation::Operation;
use crate::payload::{Payload, Reply};
use crate::views::account::{DesktopGrantView, SessionIssuedView};

impl ApiDispatcher {
    /// Authenticate and bind the request before decoding a desktop grant body.
    pub(crate) fn dispatch_desktop_grant(&self, request: Request) -> Result<Reply> {
        if request.operation == Operation::IssueDesktopGrant {
            let identity = self.auth.authenticate(
                request
                    .credential
                    .as_deref()
                    .ok_or(ApiError::Unauthenticated)?,
            )?;
            self.auth.csrf(
                &identity,
                request.origin.as_deref(),
                request.csrf.as_deref(),
            )?;
            let input: DesktopGrantRequest = body(&request.body)?;
            let result = self.auth.issue_desktop_grant(
                &identity,
                &input.challenge,
                input.return_to.as_deref(),
                &request.peer,
            )?;
            return Ok(Reply::created(Payload::DesktopGrant(DesktopGrantView {
                grant: result.grant,
                expires_at: result.expires_at,
            })));
        }
        let client = self.auth.origin(request.origin.as_deref())?;
        let input: DesktopGrantCallback = body(&request.body)?;
        let result = self.auth.exchange_desktop_grant(
            &input.grant,
            &input.verifier,
            request.credential.as_deref(),
            &request.peer,
        )?;
        let issued = result.session;
        let max_age = (issued.identity.session.expires_at - issued.identity.session.created_at)
            .num_seconds()
            .max(0);
        let session = self.platform.session(&issued.identity)?;
        Ok(Reply {
            cookie: Some(cookie(&issued.credential, max_age, client)),
            ..Reply::ok(Payload::SessionIssued(SessionIssuedView {
                session,
                return_to: result.return_to,
            }))
        })
    }
}

#[cfg(test)]
#[path = "_tests_/desktop_grant_api_tests.rs"]
mod tests;
