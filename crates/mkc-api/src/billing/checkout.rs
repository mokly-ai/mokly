//! Owner-only Checkout creation from one durable exact request.

use std::result::Result as StdResult;

use chrono::Duration;
use mkc_billing::prices::VerifiedPriceIds;
use mkc_billing_interface::error::{Error as ProviderError, RequestOutcome};
use mkc_domain::app_paths;
use mkc_domain::billing::CATALOGUE;
use mkc_domain::ids::{OrganizationId, UserId};
use mkc_domain::values::{Role, SeatKind};
use mkc_store_interface::billing_checkout::BillingCheckoutSession;
use mkc_store_interface::billing_customer::BillingCustomer;
use mkc_store_interface::error::Error as StoreError;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::store::Callback;
use mkc_store_interface::user::User;
use thiserror::Error;

use crate::billing::error::{Error, ErrorResultExt, Result};

use super::checkout_input::provider_request;
use super::service::{DatabaseBillingService, Permission, authorize};
use super::views::HostedSession;

const CHECKOUT_LIFETIME_HOURS: i64 = 1;

#[derive(Debug, Error)]
enum CheckoutFailure {
    #[error("[mkc-api/billing/checkout] provider omitted the hosted Checkout URL")]
    MissingUrl,
    #[error("[mkc-api/billing/checkout] provider replay changed the hosted session")]
    ChangedReplay,
    #[error("[mkc-api/billing/checkout] {kind:?} quantity {quantity} exceeds persisted range")]
    QuantityOutOfRange { kind: SeatKind, quantity: i64 },
    #[error("[mkc-api/billing/checkout] trial period {days} exceeds persisted range")]
    TrialPeriodOutOfRange { days: u32 },
}

fn persisted_quantity(kind: SeatKind, quantity: i64) -> StdResult<i32, CheckoutFailure> {
    i32::try_from(quantity).map_err(|_| CheckoutFailure::QuantityOutOfRange { kind, quantity })
}

fn persisted_trial_days(days: u32) -> StdResult<i32, CheckoutFailure> {
    i32::try_from(days).map_err(|_| CheckoutFailure::TrialPeriodOutOfRange { days })
}

impl DatabaseBillingService {
    pub(super) fn start_checkout(
        &self,
        actor: UserId,
        workspace: OrganizationId,
    ) -> Result<HostedSession> {
        let prices = self
            .prices
            .identities()
            .ok_or(Error::OperationUnavailable)?;
        let (workspace_record, owner, customer) = self.checkout_identity(actor, workspace)?;
        let customer =
            self.ensure_customer(workspace, &workspace_record.name, &owner.email, customer)?;
        let request = self.reserve_checkout(actor, workspace, &customer, &prices)?;
        if let Some(url) = request.provider_session_url {
            return Ok(HostedSession { url });
        }
        let session = match self
            .provider
            .create_checkout_session(&provider_request(&request)?)
        {
            Ok(session) => session,
            Err(error) => {
                self.handle_checkout_failure(&request, &error);
                return Err(Error::from_provider(error));
            }
        };
        let url = session
            .url
            .ok_or_else(|| Error::internal(CheckoutFailure::MissingUrl))?;
        self.record_checkout_session(&request, &session.id, &url)
    }

    fn checkout_identity(
        &self,
        actor: UserId,
        workspace: OrganizationId,
    ) -> Result<(Organization, User, Option<BillingCustomer>)> {
        let mut workspace_record = None;
        let mut role = None;
        let mut owner = None;
        let mut customer = None;
        let mut live = false;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                workspace_record = queries.organization(workspace)?;
                role = queries
                    .members(workspace)?
                    .into_iter()
                    .find(|member| member.user_id == Some(actor))
                    .map(|member| member.role);
                if role == Some(Role::Owner) {
                    owner = queries.user(actor)?;
                    customer = queries.billing_customer(workspace)?;
                    live = queries
                        .billing_subscription(workspace)?
                        .is_some_and(|value| value.status.is_live());
                }
                Ok(())
            }))
            .context("read Checkout policy")?;
        if workspace_record.is_none() || role.is_none() {
            return Err(Error::NotFound);
        }
        authorize(role.ok_or(Error::NotFound)?, Permission::Manage)?;
        if live {
            return Err(Error::SubscriptionActive);
        }
        Ok((
            workspace_record.ok_or(Error::NotFound)?,
            owner.ok_or(Error::NotFound)?,
            customer,
        ))
    }

    fn reserve_checkout(
        &self,
        actor: UserId,
        workspace: OrganizationId,
        expected_customer: &BillingCustomer,
        prices: &VerifiedPriceIds,
    ) -> Result<BillingCheckoutSession> {
        let now = self.runtime.now();
        let id = self.runtime.id();
        let expires_at = now + Duration::hours(CHECKOUT_LIFETIME_HOURS);
        let mut selected = None;
        let mut found = false;
        let mut role = None;
        let mut live = false;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let Some(record) = queries.organization(workspace)? else {
                    return Ok(());
                };
                found = true;
                role = queries
                    .members(workspace)?
                    .into_iter()
                    .find(|member| member.user_id == Some(actor))
                    .map(|member| member.role);
                if role != Some(Role::Owner) {
                    return Ok(());
                }
                live = queries
                    .billing_subscription(workspace)?
                    .is_some_and(|value| value.status.is_live());
                if live {
                    return Ok(());
                }
                if let Some(current) = queries.billing_checkout_session(workspace)? {
                    if current.expires_at > now {
                        selected = Some(current);
                        return Ok(());
                    }
                    queries.delete_billing_checkout_session(current.id)?;
                }
                let Some(customer) = queries.billing_customer(workspace)? else {
                    return Ok(());
                };
                if customer.provider_customer_id != expected_customer.provider_customer_id {
                    return Ok(());
                }
                let counts = queries.seat_counts(workspace)?;
                let editor_quantity = persisted_quantity(SeatKind::Editor, counts.editors.max(1))
                    .map_err(StoreError::internal)?;
                let collaborator_quantity =
                    persisted_quantity(SeatKind::Collaborator, counts.collaborators)
                        .map_err(StoreError::internal)?;
                let trial_period_days = customer
                    .trial_used_at
                    .is_none()
                    .then(|| persisted_trial_days(CATALOGUE.trial_days))
                    .transpose()
                    .map_err(StoreError::internal)?;
                let billing_path = app_paths::workspace_billing(&record.slug);
                let billing_url = app_paths::on_origin(&self.app_origin, &billing_path);
                let candidate = BillingCheckoutSession {
                    id,
                    organization_id: workspace,
                    provider_customer_id: customer.provider_customer_id,
                    editor_price_id: prices.editor.clone(),
                    editor_quantity,
                    collaborator_price_id: prices.collaborator.clone(),
                    collaborator_quantity,
                    trial_period_days,
                    success_url: format!("{billing_url}?checkout=success"),
                    cancel_url: format!("{billing_url}?checkout=cancelled"),
                    expires_at,
                    idempotency_key: format!("checkout:{id}"),
                    provider_session_id: None,
                    provider_session_url: None,
                    created_at: now,
                    version: 1,
                };
                selected = Some(queries.reserve_billing_checkout_session(&candidate)?);
                Ok(())
            }))
            .context("reserve durable Checkout request")?;
        if !found || role.is_none() {
            return Err(Error::NotFound);
        }
        authorize(role.ok_or(Error::NotFound)?, Permission::Manage)?;
        if live {
            return Err(Error::SubscriptionActive);
        }
        selected.ok_or(Error::NotFound)
    }

    fn handle_checkout_failure(&self, request: &BillingCheckoutSession, error: &ProviderError) {
        if error.request_outcome() != RequestOutcome::Rejected {
            return;
        }
        if let Err(release_error) = self.delete_incomplete_checkout(request) {
            tracing::warn!(checkout_id = %request.id, error = ?release_error, "failed to release rejected Checkout request");
        }
    }

    fn delete_incomplete_checkout(&self, request: &BillingCheckoutSession) -> Result<()> {
        self.store
            .transaction(&mut Callback(&mut |queries| {
                if queries
                    .billing_checkout_session(request.organization_id)?
                    .is_some_and(|current| {
                        current.id == request.id && current.provider_session_id.is_none()
                    })
                {
                    queries.delete_billing_checkout_session(request.id)?;
                }
                Ok(())
            }))
            .context("release rejected Checkout request")
    }

    fn record_checkout_session(
        &self,
        request: &BillingCheckoutSession,
        provider_id: &str,
        provider_url: &str,
    ) -> Result<HostedSession> {
        let mut stored_url = provider_url.to_owned();
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let Some(mut current) =
                    queries.billing_checkout_session(request.organization_id)?
                else {
                    return Ok(());
                };
                if current.id != request.id {
                    return Ok(());
                }
                if let (Some(id), Some(url)) = (
                    current.provider_session_id.as_deref(),
                    current.provider_session_url.as_deref(),
                ) {
                    if id != provider_id || url != provider_url {
                        return Err(mkc_store_interface::error::Error::internal(
                            CheckoutFailure::ChangedReplay,
                        ));
                    }
                    stored_url = url.to_owned();
                    return Ok(());
                }
                current.provider_session_id = Some(provider_id.to_owned());
                current.provider_session_url = Some(provider_url.to_owned());
                current.version += 1;
                queries.save_billing_checkout_session(&current)
            }))
            .context("record Checkout provider session")?;
        Ok(HostedSession { url: stored_url })
    }
}

#[cfg(test)]
#[path = "_tests_/checkout_tests.rs"]
mod checkout_tests;
