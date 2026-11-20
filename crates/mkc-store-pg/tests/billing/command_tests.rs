//! Durable Checkout and seat-command persistence scenarios.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::billing_checkout::BillingCheckoutSession;
use mkc_store_interface::billing_customer::BillingCustomer;
use mkc_store_interface::billing_seat_command::{BillingSeatCommand, SeatCommandOperation};
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::BillingSubscription;
use uuid::Uuid;

use super::support;

#[test]
fn checkout_reservation_keeps_one_exact_request_until_deleted() {
    support::run(&mut |queries| {
        let organization = support::organization("Checkout command", Plan::Free);
        queries.insert_organization(&organization)?;
        let now = instant();
        queries.save_billing_customer(&customer(organization.id, now))?;
        let first = checkout(organization.id, now, 1);
        let competing = checkout(organization.id, now + Duration::seconds(1), 3);

        let reserved = queries.reserve_billing_checkout_session(&first)?;
        let replayed = queries.reserve_billing_checkout_session(&competing)?;
        assert_eq!(reserved.id, first.id);
        assert_eq!(replayed.id, first.id);
        assert_eq!(replayed.editor_quantity, 1);
        assert_eq!(replayed.idempotency_key, first.idempotency_key);

        let mut completed = replayed;
        completed.provider_session_id = Some("cs_exact".into());
        completed.provider_session_url = Some("https://checkout.test/cs_exact".into());
        completed.version += 1;
        queries.save_billing_checkout_session(&completed)?;
        assert_eq!(
            queries
                .billing_checkout_session(organization.id)?
                .unwrap()
                .provider_session_url
                .as_deref(),
            Some("https://checkout.test/cs_exact")
        );

        queries.delete_billing_checkout_session(first.id)?;
        let replacement = queries.reserve_billing_checkout_session(&competing)?;
        assert_eq!(replacement.id, competing.id);
        assert_eq!(replacement.editor_quantity, 3);
        Ok(())
    });
}

#[test]
fn seat_command_claims_are_unique_and_lease_fenced() {
    support::run(&mut |queries| {
        let organization = support::organization("Seat command", Plan::Team);
        queries.insert_organization(&organization)?;
        let now = instant();
        queries.save_billing_subscription(&subscription(organization.id, now))?;
        let first = command(organization.id, now, 2);
        let competing = command(organization.id, now, 4);
        assert_eq!(queries.reserve_billing_seat_command(&first)?.id, first.id);
        assert_eq!(
            queries.reserve_billing_seat_command(&competing)?.id,
            first.id
        );

        let first_lease = Uuid::now_v7();
        let second_lease = Uuid::now_v7();
        let claimed = queries
            .claim_billing_seat_command(first.id, first_lease, now, now + Duration::minutes(5))?
            .unwrap();
        assert_eq!(claimed.lease, Some(first_lease));
        assert_eq!(claimed.attempts, 1);
        assert!(
            queries
                .claim_billing_seat_command(
                    first.id,
                    second_lease,
                    now,
                    now + Duration::minutes(5),
                )?
                .is_none()
        );
        assert!(!queries.release_billing_seat_command(
            first.id,
            second_lease,
            now + Duration::hours(1),
        )?);
        assert!(queries.release_billing_seat_command(
            first.id,
            first_lease,
            now + Duration::hours(1),
        )?);
        assert!(
            queries
                .claim_billing_seat_command(
                    first.id,
                    second_lease,
                    now + Duration::minutes(59),
                    now + Duration::minutes(64),
                )?
                .is_none()
        );

        queries.delete_organization(organization.id)?;
        assert!(
            queries
                .billing_seat_command(organization.id, SeatKind::Editor)?
                .is_none()
        );
        Ok(())
    });
}

fn instant() -> DateTime<Utc> {
    DateTime::from_timestamp(1_800_000_000, 0).unwrap()
}

fn customer(
    organization_id: mkc_domain::ids::OrganizationId,
    now: DateTime<Utc>,
) -> BillingCustomer {
    BillingCustomer {
        organization_id,
        provider_customer_id: format!("cus_{}", Uuid::now_v7().simple()),
        trial_used_at: None,
        created_at: now,
        version: 1,
    }
}

fn checkout(
    organization_id: mkc_domain::ids::OrganizationId,
    now: DateTime<Utc>,
    editor_quantity: i32,
) -> BillingCheckoutSession {
    let id = Uuid::now_v7();
    BillingCheckoutSession {
        id,
        organization_id,
        provider_customer_id: "cus_checkout".into(),
        editor_price_id: "price_editor".into(),
        editor_quantity,
        collaborator_price_id: "price_collaborator".into(),
        collaborator_quantity: 0,
        trial_period_days: Some(7),
        success_url: "https://app.test/success".into(),
        cancel_url: "https://app.test/cancel".into(),
        expires_at: now + Duration::hours(1),
        idempotency_key: format!("checkout:{id}"),
        provider_session_id: None,
        provider_session_url: None,
        created_at: now,
        version: 1,
    }
}

fn subscription(
    organization_id: mkc_domain::ids::OrganizationId,
    now: DateTime<Utc>,
) -> BillingSubscription {
    BillingSubscription {
        organization_id,
        provider_subscription_id: "sub_seats".into(),
        status: SubscriptionStatus::Active,
        current_period_end: Some(now + Duration::days(30)),
        trial_end: None,
        cancel_at_period_end: false,
        payment_failed_at: None,
        payment_updated_at: None,
        updated_at: now,
        seats_checked_at: None,
        version: 1,
    }
}

fn command(
    organization_id: mkc_domain::ids::OrganizationId,
    now: DateTime<Utc>,
    quantity: i32,
) -> BillingSeatCommand {
    let id = Uuid::now_v7();
    BillingSeatCommand {
        id,
        organization_id,
        seat_kind: SeatKind::Editor,
        provider_subscription_id: "sub_seats".into(),
        operation: SeatCommandOperation::Update,
        provider_item_id: Some("si_editor".into()),
        price_id: "price_editor".into(),
        quantity,
        idempotency_key: format!("seats:{organization_id}:editor:{id}"),
        due_at: now,
        attempts: 0,
        lease: None,
        lease_until: None,
        created_at: now,
    }
}
