//! Billing delivery queue claim and exhausted-lease recovery scenarios.

use chrono::{DateTime, Duration, Utc};
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::billing_state::BillingFailure;
use mkc_store_interface::github_state::DeliveryStatus;
use uuid::Uuid;

use super::support;

#[test]
fn claim_returns_the_due_delivery_and_increments_attempts() {
    support::run(&mut |queries| {
        let now = Utc::now();
        let due = delivery("evt_due", now - Duration::seconds(1));
        let future = delivery("evt_future", now + Duration::minutes(1));
        queries.save_billing_delivery(&due)?;
        queries.save_billing_delivery(&future)?;

        let lease = Uuid::now_v7();
        let claimed = queries
            .claim_billing_delivery(now, lease, now + Duration::minutes(5))?
            .unwrap();
        assert_eq!(claimed.id, due.id);
        assert_eq!(claimed.attempts, 1);
        assert_eq!(claimed.status, DeliveryStatus::Processing);
        assert_eq!(claimed.lease, Some(lease));
        assert!(
            queries
                .claim_billing_delivery(now, Uuid::now_v7(), now + Duration::minutes(5))?
                .is_none()
        );
        Ok(())
    });
}

#[test]
fn expiration_marks_an_exhausted_lease_failed() {
    support::run(&mut |queries| {
        let now = Utc::now();
        // The shared database keeps what other suites retained, so the count is
        // compared with what it was rather than with an absolute number.
        let dead_letters = queries.billing_dead_letter_count()?;
        let mut exhausted = delivery("evt_exhausted", now - Duration::minutes(10));
        exhausted.attempts = 8;
        exhausted.status = DeliveryStatus::Processing;
        exhausted.lease = Some(Uuid::now_v7());
        exhausted.lease_until = Some(now - Duration::seconds(1));
        queries.save_billing_delivery(&exhausted)?;

        queries.expire_billing_deliveries(now)?;
        let expired = queries.billing_delivery(&exhausted.id)?.unwrap();
        assert_eq!(expired.status, DeliveryStatus::Failed);
        assert_eq!(expired.last_failure, Some(BillingFailure::Internal));
        assert_eq!(expired.lease, None);
        assert_eq!(expired.lease_until, None);
        assert_eq!(queries.billing_dead_letter_count()?, dead_letters + 1);
        Ok(())
    });
}

fn delivery(id: &str, due_at: DateTime<Utc>) -> BillingDelivery {
    BillingDelivery {
        id: format!("{id}{}", Uuid::now_v7().simple()),
        event: "customer.subscription.updated".into(),
        body: br#"{"type":"customer.subscription.updated"}"#.to_vec(),
        received_at: due_at,
        due_at,
        attempts: 0,
        status: DeliveryStatus::Pending,
        lease: None,
        lease_until: None,
        last_failure: None,
    }
}
