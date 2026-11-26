//! Billing route authentication and typed service dispatch.

use std::collections::BTreeMap;

use mkc_domain::ids::OrganizationId;
use uuid::Uuid;

use crate::billing::service::BillingService;
use crate::dispatch::{ApiDispatcher, Request};
use crate::error::{ApiError, Result};
use crate::operation::Operation;
use crate::payload::{Payload, Reply};

impl ApiDispatcher {
    /// Handle a billing operation after the gate selects the service.
    pub(crate) fn dispatch_billing(
        &self,
        request: Request,
        billing: &dyn BillingService,
    ) -> Result<Reply> {
        if request.operation == Operation::ReceiveBillingWebhook {
            billing.accept(
                request
                    .billing_signature
                    .as_deref()
                    .ok_or(ApiError::ValidationFailed)?,
                &request.body,
            )?;
            return Ok(Reply {
                status: 202,
                ..Reply::empty()
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
        let workspace = workspace(&request)?;
        match request.operation {
            Operation::GetBilling => Ok(Reply::ok(Payload::Billing(
                billing.read(identity.user.id, workspace)?,
            ))),
            Operation::StartCheckout => {
                empty_body(&request.body)?;
                Ok(Reply::created(Payload::BillingSession(
                    billing.checkout(identity.user.id, workspace)?,
                )))
            }
            Operation::OpenBillingPortal => {
                empty_body(&request.body)?;
                Ok(Reply::created(Payload::BillingSession(
                    billing.portal(identity.user.id, workspace)?,
                )))
            }
            _ => Err(ApiError::OperationUnavailable),
        }
    }
}

fn workspace(request: &Request) -> Result<OrganizationId> {
    request
        .params
        .get("workspaceId")
        .and_then(|value| value.parse::<Uuid>().ok())
        .map(OrganizationId)
        .ok_or(ApiError::ValidationFailed)
}

fn empty_body(body: &[u8]) -> Result<()> {
    match serde_json::from_slice::<BTreeMap<String, ()>>(body) {
        Ok(value) if value.is_empty() => Ok(()),
        _ => Err(ApiError::ValidationFailed),
    }
}
