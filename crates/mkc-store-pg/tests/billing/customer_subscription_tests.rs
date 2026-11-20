//! Billing customer, subscription, item upsert and cascade scenarios.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::billing_customer::BillingCustomer;
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionItem};
use uuid::Uuid;

use super::support;

#[test]
fn customer_subscription_and_items_upsert_and_lookup() {
    support::run(&mut |queries| {
        let organization = support::organization("Billing records", Plan::Team);
        queries.insert_organization(&organization)?;
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();

        let mut customer = BillingCustomer {
            organization_id: organization.id,
            provider_customer_id: provider_id("cus"),
            trial_used_at: None,
            created_at: now,
            version: 1,
        };
        queries.save_billing_customer(&customer)?;
        assert_eq!(
            queries
                .billing_customer_by_provider_id(&customer.provider_customer_id)?
                .unwrap()
                .organization_id,
            organization.id
        );
        let first_customer_id = customer.provider_customer_id.clone();
        customer.provider_customer_id = provider_id("cus");
        customer.trial_used_at = Some(now);
        customer.version = 2;
        queries.save_billing_customer(&customer)?;
        assert!(
            queries
                .billing_customer_by_provider_id(&first_customer_id)?
                .is_none()
        );
        let saved_customer = queries.billing_customer(organization.id)?.unwrap();
        assert_eq!(
            saved_customer.provider_customer_id,
            customer.provider_customer_id
        );
        assert_eq!(saved_customer.trial_used_at, Some(now));
        assert_eq!(saved_customer.version, 2);

        let mut subscription = subscription(organization.id, now);
        queries.save_billing_subscription(&subscription)?;
        subscription.status = SubscriptionStatus::Active;
        subscription.current_period_end = Some(now + Duration::days(30));
        subscription.trial_end = None;
        subscription.cancel_at_period_end = true;
        subscription.payment_failed_at = Some(now + Duration::hours(1));
        subscription.payment_updated_at = Some(now + Duration::hours(1));
        subscription.updated_at = now + Duration::hours(2);
        subscription.version = 2;
        queries.save_billing_subscription(&subscription)?;
        let saved_subscription = queries
            .billing_subscription_by_provider_id(&subscription.provider_subscription_id)?
            .unwrap();
        assert_eq!(saved_subscription.status, SubscriptionStatus::Active);
        assert_eq!(saved_subscription.version, 2);
        assert!(saved_subscription.cancel_at_period_end);
        assert_eq!(
            saved_subscription.payment_failed_at,
            subscription.payment_failed_at
        );
        assert_eq!(
            saved_subscription.payment_updated_at,
            subscription.payment_updated_at
        );
        // Other suites leave live subscriptions in the shared database, so the
        // listing is asked for this organization's rather than for exactly one,
        // with a limit no retained set has reached.
        let live = queries.live_billing_subscriptions(1_000)?;
        assert!(
            live.iter()
                .any(|value| value.organization_id == organization.id)
        );
        assert!(live.iter().all(|value| value.status.is_live()));

        let mut editor = item(organization.id, SeatKind::Editor, 1);
        queries.save_billing_subscription_item(&editor)?;
        editor.quantity = 3;
        queries.save_billing_subscription_item(&editor)?;
        let collaborator = item(organization.id, SeatKind::Collaborator, 2);
        queries.save_billing_subscription_item(&collaborator)?;
        let replacement_editor = item(organization.id, SeatKind::Editor, 5);
        queries.save_billing_subscription_item(&replacement_editor)?;
        let items = queries.billing_subscription_items(organization.id)?;
        assert_eq!(items.len(), 2);
        let saved_editor = items
            .iter()
            .find(|item| item.seat_kind == SeatKind::Editor)
            .unwrap();
        assert_eq!(saved_editor.id, editor.id);
        assert_eq!(
            saved_editor.provider_item_id,
            replacement_editor.provider_item_id
        );
        assert_eq!(saved_editor.quantity, 5);
        queries.delete_billing_subscription_item(collaborator.id)?;
        assert_eq!(
            queries.billing_subscription_items(organization.id)?.len(),
            1
        );
        queries.delete_billing_subscription(organization.id)?;
        assert!(queries.billing_subscription(organization.id)?.is_none());
        assert!(
            queries
                .billing_subscription_items(organization.id)?
                .is_empty()
        );
        Ok(())
    });
}

#[test]
fn deleting_an_organization_cascades_billing_records() {
    support::run(&mut |queries| {
        let organization = support::organization("Billing cascade", Plan::Team);
        queries.insert_organization(&organization)?;
        let now = Utc::now();
        let customer = BillingCustomer {
            organization_id: organization.id,
            provider_customer_id: provider_id("cus"),
            trial_used_at: None,
            created_at: now,
            version: 1,
        };
        let subscription = subscription(organization.id, now);
        let item = item(organization.id, SeatKind::Editor, 1);
        queries.save_billing_customer(&customer)?;
        queries.save_billing_subscription(&subscription)?;
        queries.save_billing_subscription_item(&item)?;

        queries.delete_organization(organization.id)?;
        assert!(queries.billing_customer(organization.id)?.is_none());
        assert!(queries.billing_subscription(organization.id)?.is_none());
        assert!(
            queries
                .billing_subscription_items(organization.id)?
                .is_empty()
        );
        Ok(())
    });
}

fn subscription(organization_id: OrganizationId, now: DateTime<Utc>) -> BillingSubscription {
    BillingSubscription {
        organization_id,
        provider_subscription_id: provider_id("sub"),
        status: SubscriptionStatus::Trialing,
        current_period_end: None,
        trial_end: Some(now + Duration::days(7)),
        cancel_at_period_end: false,
        payment_failed_at: None,
        payment_updated_at: None,
        updated_at: now,
        seats_checked_at: None,
        version: 1,
    }
}

fn item(
    organization_id: OrganizationId,
    seat_kind: SeatKind,
    quantity: i32,
) -> BillingSubscriptionItem {
    BillingSubscriptionItem {
        id: Uuid::now_v7(),
        organization_id,
        seat_kind,
        provider_item_id: provider_id("si"),
        price_id: provider_id("price"),
        quantity,
    }
}

fn provider_id(prefix: &str) -> String {
    format!("{prefix}_{}", Uuid::now_v7().simple())
}
