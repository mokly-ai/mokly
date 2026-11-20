//! Least-recently-checked ordering rotates every live subscription through a batch.

use std::collections::BTreeSet;

use chrono::{Duration, Utc};
use mkc_domain::values::Plan;
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::BillingSubscription;

use super::support;

#[test]
fn checked_batches_are_disjoint_before_the_order_wraps() {
    support::run(&mut |queries| {
        let now = Utc::now();
        for subscription in queries.live_billing_subscriptions(1_000)? {
            queries.mark_seats_checked(subscription.organization_id, now + Duration::hours(1))?;
        }
        let mut expected = BTreeSet::new();
        for index in 0..5 {
            let organization = support::organization(&format!("Seat rotation {index}"), Plan::Team);
            expected.insert(organization.id);
            queries.insert_organization(&organization)?;
            queries.save_billing_subscription(&BillingSubscription {
                organization_id: organization.id,
                provider_subscription_id: format!("sub_{}", organization.id.0.simple()),
                status: SubscriptionStatus::Active,
                current_period_end: Some(now + Duration::days(30)),
                trial_end: None,
                cancel_at_period_end: false,
                payment_failed_at: None,
                payment_updated_at: None,
                updated_at: now,
                seats_checked_at: None,
                version: 1,
            })?;
        }

        let first = queries.live_billing_subscriptions(3)?;
        let first_ids: BTreeSet<_> = first.iter().map(|value| value.organization_id).collect();
        for subscription in first {
            queries.mark_seats_checked(subscription.organization_id, now)?;
        }
        let second = queries.live_billing_subscriptions(2)?;
        let second_ids: BTreeSet<_> = second.iter().map(|value| value.organization_id).collect();
        assert!(first_ids.is_disjoint(&second_ids));
        let covered: BTreeSet<_> = first_ids.union(&second_ids).copied().collect();
        assert_eq!(covered, expected);
        for subscription in second {
            queries.mark_seats_checked(subscription.organization_id, now + Duration::seconds(1))?;
        }

        let wrapped: BTreeSet<_> = queries
            .live_billing_subscriptions(3)?
            .into_iter()
            .map(|value| value.organization_id)
            .collect();
        assert_eq!(wrapped, first_ids);
        Ok(())
    });
}
