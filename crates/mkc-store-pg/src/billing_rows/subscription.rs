//! Private Diesel row mapping for billing_subscriptions.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing::billing_subscriptions;
use mkc_store_interface::billing_subscription::BillingSubscription;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = billing_subscriptions)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(organization_id))]
pub(crate) struct Row {
    organization_id: Uuid,
    provider_subscription_id: String,
    status: String,
    current_period_end: Option<DateTime<Utc>>,
    trial_end: Option<DateTime<Utc>>,
    cancel_at_period_end: bool,
    payment_failed_at: Option<DateTime<Utc>>,
    payment_updated_at: Option<DateTime<Utc>>,
    updated_at: DateTime<Utc>,
    seats_checked_at: Option<DateTime<Utc>>,
    version: i64,
}

impl Row {
    pub(crate) fn dto(self) -> Result<BillingSubscription> {
        Ok(BillingSubscription {
            organization_id: self.organization_id.into(),
            provider_subscription_id: self.provider_subscription_id,
            status: self
                .status
                .parse()
                .context("decode billing_subscriptions status")?,
            current_period_end: self.current_period_end,
            trial_end: self.trial_end,
            cancel_at_period_end: self.cancel_at_period_end,
            payment_failed_at: self.payment_failed_at,
            payment_updated_at: self.payment_updated_at,
            updated_at: self.updated_at,
            seats_checked_at: self.seats_checked_at,
            version: self.version,
        })
    }

    pub(crate) fn record(value: &BillingSubscription) -> Self {
        Self {
            organization_id: value.organization_id.0,
            provider_subscription_id: value.provider_subscription_id.clone(),
            status: value.status.as_str().to_owned(),
            current_period_end: value.current_period_end,
            trial_end: value.trial_end,
            cancel_at_period_end: value.cancel_at_period_end,
            payment_failed_at: value.payment_failed_at,
            payment_updated_at: value.payment_updated_at,
            updated_at: value.updated_at,
            seats_checked_at: value.seats_checked_at,
            version: value.version,
        }
    }
}
