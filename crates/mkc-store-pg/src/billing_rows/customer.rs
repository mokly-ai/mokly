//! Private Diesel row mapping for billing_customers.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing::billing_customers;
use mkc_store_interface::billing_customer::BillingCustomer;
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = billing_customers)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(organization_id))]
pub(crate) struct Row {
    organization_id: Uuid,
    provider_customer_id: String,
    trial_used_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    version: i64,
}

impl Row {
    pub(crate) fn dto(self) -> BillingCustomer {
        BillingCustomer {
            organization_id: self.organization_id.into(),
            provider_customer_id: self.provider_customer_id,
            trial_used_at: self.trial_used_at,
            created_at: self.created_at,
            version: self.version,
        }
    }

    pub(crate) fn record(value: &BillingCustomer) -> Self {
        Self {
            organization_id: value.organization_id.0,
            provider_customer_id: value.provider_customer_id.clone(),
            trial_used_at: value.trial_used_at,
            created_at: value.created_at,
            version: value.version,
        }
    }
}
