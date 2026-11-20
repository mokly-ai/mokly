//! Fenced reconciliation committed atomically with delivery completion.

use chrono::{DateTime, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionItem};
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::{Callback, Queries};
use uuid::Uuid;

use super::handlers::Prepared;
use super::plan::{NormalizedItem, normalize, payment_failed};
use super::reconcile_commands::clear_confirmed_commands;
use super::retry::AttemptError;
use super::worker::DatabaseBillingDeliveryWorker;

impl DatabaseBillingDeliveryWorker {
    pub(super) fn apply(
        &self,
        delivery: &BillingDelivery,
        lease: Uuid,
        prepared: Prepared,
    ) -> Result<(), AttemptError> {
        match prepared {
            Prepared::Ignored => self.complete(delivery, lease, DeliveryStatus::Ignored),
            Prepared::Reconcile {
                organization,
                subscription,
                created,
            } => self.reconcile(delivery, lease, organization, &subscription, created),
            Prepared::Invoice {
                organization,
                subscription,
                created,
            } => self.apply_invoice(delivery, lease, organization, &subscription, created),
        }
    }

    fn reconcile(
        &self,
        delivery: &BillingDelivery,
        lease: Uuid,
        organization: OrganizationId,
        provider: &mkc_billing_interface::objects::Subscription,
        created: DateTime<Utc>,
    ) -> Result<(), AttemptError> {
        let editor_id = self.runtime.id();
        let collaborator_id = self.runtime.id();
        let mut conflicting_subscription = None;
        let mut malformed = false;
        let result = self.store.transaction(&mut Callback(&mut |queries| {
            conflicting_subscription = None;
            malformed = false;
            let Some(mut current_delivery) = fenced(queries, delivery, lease)? else {
                return Ok(());
            };
            let existing = queries.billing_subscription(organization)?;
            if existing
                .as_ref()
                .is_some_and(|value| value.updated_at > created)
            {
                finish(queries, &mut current_delivery, DeliveryStatus::Done)?;
                return Ok(());
            }
            if let Some(existing) = &existing
                && existing.provider_subscription_id != provider.id
                && existing.status.is_live()
            {
                conflicting_subscription = Some(existing.provider_subscription_id.clone());
                return Ok(());
            }
            let Some(mut organization_record) = queries.organization(organization)? else {
                finish(queries, &mut current_delivery, DeliveryStatus::Ignored)?;
                return Ok(());
            };
            let Some(mut customer) = queries.billing_customer(organization)? else {
                finish(queries, &mut current_delivery, DeliveryStatus::Ignored)?;
                return Ok(());
            };
            let local_items = queries.billing_subscription_items(organization)?;
            let normalized = match normalize(provider, self.prices.as_ref(), &local_items) {
                Ok(normalized) => normalized,
                Err(_) => {
                    malformed = true;
                    return Ok(());
                }
            };
            let matching_binding = existing.as_ref().filter(|value| {
                value.provider_subscription_id == normalized.provider_subscription_id
            });
            let payment_failed_at = matching_binding.and_then(|value| value.payment_failed_at);
            let payment_updated_at = matching_binding.and_then(|value| value.payment_updated_at);
            let checkout_id = provider
                .metadata
                .get("checkout_session_id")
                .and_then(|value| value.parse::<Uuid>().ok());
            let checkout = match checkout_id {
                Some(id) => queries
                    .billing_checkout_session(organization)?
                    .filter(|value| value.id == id),
                None => None,
            };
            queries.save_billing_subscription(&BillingSubscription {
                organization_id: organization,
                provider_subscription_id: normalized.provider_subscription_id.clone(),
                status: normalized.status,
                current_period_end: normalized.current_period_end,
                trial_end: normalized.trial_end,
                cancel_at_period_end: normalized.cancel_at_period_end,
                payment_failed_at,
                payment_updated_at,
                updated_at: created,
                seats_checked_at: existing.as_ref().and_then(|value| value.seats_checked_at),
                version: existing.as_ref().map_or(1, |value| value.version + 1),
            })?;
            for item in &normalized.items {
                save_item(
                    queries,
                    organization,
                    item,
                    &local_items,
                    editor_id,
                    collaborator_id,
                )?;
            }
            for item in local_items.iter().filter(|item| {
                !normalized
                    .items
                    .iter()
                    .any(|provider| provider.seat_kind == item.seat_kind)
            }) {
                queries.delete_billing_subscription_item(item.id)?;
            }
            clear_confirmed_commands(
                queries,
                organization,
                &normalized.provider_subscription_id,
                &normalized.items,
            )?;
            // The stored Checkout request says whether that exact session
            // offered the trial, and Checkout copies its identity into the
            // subscription metadata, so binding the subscription consumes the
            // trial even when a delayed delivery first observes it as active.
            if checkout
                .as_ref()
                .is_some_and(|value| value.trial_period_days.is_some())
                && customer.trial_used_at.is_none()
            {
                customer.trial_used_at = Some(created);
                customer.version += 1;
                queries.save_billing_customer(&customer)?;
            }
            if let Some(checkout) = checkout {
                queries.delete_billing_checkout_session(checkout.id)?;
            }
            if organization_record.plan != normalized.plan {
                organization_record.plan = normalized.plan;
                organization_record.version += 1;
                queries.save_organization(&organization_record)?;
            }
            finish(queries, &mut current_delivery, DeliveryStatus::Done)
        }));
        match result {
            Ok(()) => {
                if malformed {
                    Err(AttemptError::Malformed)
                } else if let Some(bound_subscription) = conflicting_subscription {
                    tracing::error!(
                        organization_id = %organization,
                        bound_subscription_id = bound_subscription,
                        conflicting_subscription_id = provider.id,
                        "billing delivery conflicts with the live subscription binding"
                    );
                    Err(AttemptError::Conflict)
                } else {
                    Ok(())
                }
            }
            Err(error) => Err(AttemptError::Store(error)),
        }
    }

    fn apply_invoice(
        &self,
        delivery: &BillingDelivery,
        lease: Uuid,
        organization: OrganizationId,
        provider: &mkc_billing_interface::objects::Subscription,
        created: DateTime<Utc>,
    ) -> Result<(), AttemptError> {
        let failed = payment_failed(provider)?;
        let result = self.store.transaction(&mut Callback(&mut |queries| {
            let Some(mut current_delivery) = fenced(queries, delivery, lease)? else {
                return Ok(());
            };
            let Some(mut subscription) = queries.billing_subscription(organization)? else {
                finish(queries, &mut current_delivery, DeliveryStatus::Ignored)?;
                return Ok(());
            };
            if subscription.provider_subscription_id != provider.id {
                finish(queries, &mut current_delivery, DeliveryStatus::Ignored)?;
                return Ok(());
            }
            if subscription
                .payment_updated_at
                .is_none_or(|updated_at| updated_at <= created)
            {
                subscription.payment_failed_at = failed.then_some(created);
                subscription.payment_updated_at = Some(created);
                subscription.version += 1;
                queries.save_billing_subscription(&subscription)?;
            }
            finish(queries, &mut current_delivery, DeliveryStatus::Done)
        }));
        match result {
            Ok(()) => Ok(()),
            Err(error) => Err(AttemptError::Store(error)),
        }
    }

    fn complete(
        &self,
        delivery: &BillingDelivery,
        lease: Uuid,
        status: DeliveryStatus,
    ) -> Result<(), AttemptError> {
        let result = self.store.transaction(&mut Callback(&mut |queries| {
            let Some(mut current) = fenced(queries, delivery, lease)? else {
                return Ok(());
            };
            finish(queries, &mut current, status)
        }));
        match result {
            Ok(()) => Ok(()),
            Err(error) => Err(AttemptError::Store(error)),
        }
    }
}

fn save_item(
    queries: &mut dyn Queries,
    organization: OrganizationId,
    provider: &NormalizedItem,
    local_items: &[BillingSubscriptionItem],
    editor_id: Uuid,
    collaborator_id: Uuid,
) -> mkc_store_interface::error::Result<()> {
    let existing = local_items
        .iter()
        .find(|item| item.seat_kind == provider.seat_kind);
    queries.save_billing_subscription_item(&BillingSubscriptionItem {
        id: existing.map_or_else(
            || match provider.seat_kind {
                SeatKind::Editor => editor_id,
                SeatKind::Collaborator => collaborator_id,
            },
            |item| item.id,
        ),
        organization_id: organization,
        seat_kind: provider.seat_kind,
        provider_item_id: provider.provider_item_id.clone(),
        price_id: provider.price_id.clone(),
        quantity: provider.quantity,
    })
}

fn fenced(
    queries: &mut dyn Queries,
    delivery: &BillingDelivery,
    lease: Uuid,
) -> mkc_store_interface::error::Result<Option<BillingDelivery>> {
    Ok(queries.billing_delivery(&delivery.id)?.filter(|current| {
        current.lease == Some(lease) && current.status == DeliveryStatus::Processing
    }))
}

fn finish(
    queries: &mut dyn Queries,
    delivery: &mut BillingDelivery,
    status: DeliveryStatus,
) -> mkc_store_interface::error::Result<()> {
    delivery.status = status;
    delivery.lease = None;
    delivery.lease_until = None;
    delivery.last_failure = None;
    queries.save_billing_delivery(delivery)
}

#[cfg(test)]
#[path = "_tests_/reconcile_tests.rs"]
mod tests;
