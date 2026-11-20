//! Durable leased provider writes for subscription seat counts.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_billing_interface::error::Error as ProviderError;
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_seat_command::{BillingSeatCommand, SeatCommandOperation};
use mkc_store_interface::store::{Callback, Store};

use crate::error::{Error, ErrorResultExt, Result};
use crate::prices::VerifiedPriceIds;
use crate::retry::retry_deadline;

use super::plan::{ActionKind, select};

const BATCH_SIZE: i64 = 100;
const LEASE_MINUTES: i64 = 5;
const CONFIRMATION_RETRY_SECONDS: u64 = 60 * 60;

/// One pass over live subscriptions that may need seat changes.
#[unimock::unimock(api = SeatReconcilerMock)]
pub trait SeatReconciler: Send + Sync {
    /// Reconcile one bounded pass and report whether live subscriptions existed.
    fn run_once(&self) -> Result<bool>;
}

/// Store-backed reconciler that accepts only startup-verified price identities.
///
/// One pass lists the least recently checked live subscriptions and stamps
/// each examined organization in the same transaction that reads its
/// subscription, seat counts and items, so later passes rotate through the
/// complete live set. That serializable transaction also inserts one durable
/// command per organization and seat kind and claims it with a five-minute
/// lease; only the lease holder calls Stripe, and the provider call runs
/// outside any transaction. Release, retry and delete writes compare the lease
/// token, so a worker whose lease expired cannot overwrite its successor.
pub struct DatabaseSeatReconciler {
    store: Arc<dyn Store>,
    runtime: Arc<dyn Runtime>,
    provider: Arc<dyn BillingProvider>,
    prices: VerifiedPriceIds,
}

impl DatabaseSeatReconciler {
    /// Construct a reconciler for one verified billing configuration.
    pub fn new(
        store: Arc<dyn Store>,
        runtime: Arc<dyn Runtime>,
        provider: Arc<dyn BillingProvider>,
        prices: VerifiedPriceIds,
    ) -> Self {
        Self {
            store,
            runtime,
            provider,
            prices,
        }
    }

    fn reconcile_kind(
        &self,
        organization: OrganizationId,
        kind: SeatKind,
        price_id: &str,
        mark_checked: bool,
    ) -> Result<Control> {
        let Some(command) = self.reserve_and_claim(organization, kind, price_id, mark_checked)?
        else {
            return Ok(Control::Continue);
        };
        let lease = command.lease.ok_or_else(|| {
            Error::internal_message("claimed billing seat command omitted its lease")
        })?;
        match self.execute(&command) {
            Ok(()) => {
                self.release(&command, lease, CONFIRMATION_RETRY_SECONDS)?;
                Ok(Control::Continue)
            }
            Err(ProviderError::RateLimited { retry_after, .. }) => {
                self.release(&command, lease, retry_after)?;
                tracing::warn!(organization_id = %organization, kind = kind.as_str(), retry_after, "billing seat reconciliation rate limited");
                Ok(Control::Stop)
            }
            Err(error) if should_delete_refused_create(command.operation, &error) => {
                self.delete_refused_create(&command, lease)?;
                tracing::warn!(organization_id = %organization, kind = kind.as_str(), "billing seat create request was refused");
                Ok(Control::NextOrganization)
            }
            Err(error) => {
                self.release(&command, lease, CONFIRMATION_RETRY_SECONDS)?;
                tracing::warn!(organization_id = %organization, kind = kind.as_str(), error = %error, "billing seat reconciliation failed");
                Ok(Control::NextOrganization)
            }
        }
    }

    fn reserve_and_claim(
        &self,
        organization: OrganizationId,
        kind: SeatKind,
        price_id: &str,
        mark_checked: bool,
    ) -> Result<Option<BillingSeatCommand>> {
        let now = self.runtime.now();
        let command_id = self.runtime.id();
        let lease = self.runtime.id();
        let lease_until = now + Duration::minutes(LEASE_MINUTES);
        let mut claimed = None;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let Some(subscription) = queries.billing_subscription(organization)? else {
                    return Ok(());
                };
                if !subscription.status.is_live() {
                    return Ok(());
                }
                let counts = queries.seat_counts(organization)?;
                let items = queries.billing_subscription_items(organization)?;
                if mark_checked {
                    queries.mark_seats_checked(organization, now)?;
                }
                if let Some(current) = queries.billing_seat_command(organization, kind)? {
                    if current.provider_subscription_id == subscription.provider_subscription_id {
                        claimed = queries.claim_billing_seat_command(
                            current.id,
                            lease,
                            now,
                            lease_until,
                        )?;
                        return Ok(());
                    }
                    queries.delete_billing_seat_command(current.id)?;
                }
                let Some(action) = select(counts, &items, kind, price_id) else {
                    return Ok(());
                };
                let (operation, provider_item_id) = match action.operation {
                    ActionKind::Create => (SeatCommandOperation::Create, None),
                    ActionKind::Update { provider_item_id } => {
                        (SeatCommandOperation::Update, Some(provider_item_id))
                    }
                    ActionKind::Delete { provider_item_id } => {
                        (SeatCommandOperation::Delete, Some(provider_item_id))
                    }
                };
                let candidate = BillingSeatCommand {
                    id: command_id,
                    organization_id: organization,
                    seat_kind: action.kind,
                    provider_subscription_id: subscription.provider_subscription_id,
                    operation,
                    provider_item_id,
                    price_id: action.price_id,
                    quantity: action.quantity,
                    idempotency_key: format!("seats:{organization}:{}:{command_id}", kind.as_str()),
                    due_at: now,
                    attempts: 0,
                    lease: None,
                    lease_until: None,
                    created_at: now,
                };
                let reserved = queries.reserve_billing_seat_command(&candidate)?;
                claimed =
                    queries.claim_billing_seat_command(reserved.id, lease, now, lease_until)?;
                Ok(())
            }))
            .context("reserve and claim billing seat command")?;
        Ok(claimed)
    }

    fn execute(&self, command: &BillingSeatCommand) -> mkc_billing_interface::error::Result<()> {
        match command.operation {
            SeatCommandOperation::Create => {
                self.provider.create_subscription_item(
                    &command.provider_subscription_id,
                    &command.price_id,
                    i64::from(command.quantity),
                    &command.idempotency_key,
                )?;
            }
            SeatCommandOperation::Update => {
                self.provider.update_subscription_item(
                    command
                        .provider_item_id
                        .as_deref()
                        .ok_or_else(ProviderError::invalid_request)?,
                    i64::from(command.quantity),
                    &command.idempotency_key,
                )?;
            }
            SeatCommandOperation::Delete => {
                let item = command
                    .provider_item_id
                    .as_deref()
                    .ok_or_else(ProviderError::invalid_request)?;
                match self.provider.delete_subscription_item(item) {
                    Ok(()) | Err(ProviderError::NotFound { .. }) => {}
                    Err(error) => return Err(error),
                }
            }
        }
        Ok(())
    }

    fn release(
        &self,
        command: &BillingSeatCommand,
        lease: uuid::Uuid,
        delay_seconds: u64,
    ) -> Result<()> {
        let due_at = retry_deadline(self.runtime.now(), delay_seconds);
        self.store
            .transaction(&mut Callback(&mut |queries| {
                queries.release_billing_seat_command(command.id, lease, due_at)?;
                Ok(())
            }))
            .context("release billing seat command lease")
    }

    fn delete_refused_create(&self, command: &BillingSeatCommand, lease: uuid::Uuid) -> Result<()> {
        self.store
            .transaction(&mut Callback(&mut |queries| {
                let current =
                    queries.billing_seat_command(command.organization_id, command.seat_kind)?;
                if current
                    .is_some_and(|current| current.id == command.id && current.lease == Some(lease))
                {
                    queries.delete_billing_seat_command(command.id)?;
                }
                Ok(())
            }))
            .context("delete refused billing seat create command")
    }
}

/// Whether this refusal invalidates a price-bearing command that may be regenerated.
fn should_delete_refused_create(operation: SeatCommandOperation, error: &ProviderError) -> bool {
    operation == SeatCommandOperation::Create
        && matches!(error, ProviderError::InvalidRequest { .. })
}

impl SeatReconciler for DatabaseSeatReconciler {
    fn run_once(&self) -> Result<bool> {
        let mut subscriptions = Vec::new();
        self.store
            .read(&mut Callback(&mut |queries| {
                subscriptions = queries.live_billing_subscriptions(BATCH_SIZE)?;
                Ok(())
            }))
            .context("list live subscriptions for seat reconciliation")?;
        let had_work = !subscriptions.is_empty();
        'organizations: for subscription in subscriptions {
            let organization = subscription.organization_id;
            match self.reconcile_kind(organization, SeatKind::Editor, &self.prices.editor, true)? {
                Control::Continue => {}
                Control::NextOrganization => continue 'organizations,
                Control::Stop => break,
            }
            match self.reconcile_kind(
                organization,
                SeatKind::Collaborator,
                &self.prices.collaborator,
                false,
            )? {
                Control::Continue | Control::NextOrganization => {}
                Control::Stop => break,
            }
        }
        Ok(had_work)
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Control {
    Continue,
    NextOrganization,
    Stop,
}

#[cfg(test)]
#[path = "_tests_/worker_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "_tests_/worker_fence_tests.rs"]
mod worker_fence_tests;
