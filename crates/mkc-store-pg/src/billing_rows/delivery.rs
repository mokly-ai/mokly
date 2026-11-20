//! Private Diesel row mapping for billing_deliveries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing::billing_deliveries;
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = billing_deliveries)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: String,
    event: String,
    body: Vec<u8>,
    received_at: DateTime<Utc>,
    due_at: DateTime<Utc>,
    attempts: i32,
    status: String,
    lease: Option<Uuid>,
    lease_until: Option<DateTime<Utc>>,
    last_failure: Option<String>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<BillingDelivery> {
        Ok(BillingDelivery {
            id: self.id,
            event: self.event,
            body: self.body,
            received_at: self.received_at,
            due_at: self.due_at,
            attempts: self.attempts,
            status: self
                .status
                .parse()
                .context("decode billing_deliveries status")?,
            lease: self.lease,
            lease_until: self.lease_until,
            last_failure: self
                .last_failure
                .map(|value| {
                    value
                        .parse()
                        .context("decode billing_deliveries last_failure")
                })
                .transpose()?,
        })
    }

    pub(crate) fn record(value: &BillingDelivery) -> Self {
        Self {
            id: value.id.clone(),
            event: value.event.clone(),
            body: value.body.clone(),
            received_at: value.received_at,
            due_at: value.due_at,
            attempts: value.attempts,
            status: value.status.as_str().to_owned(),
            lease: value.lease,
            lease_until: value.lease_until,
            last_failure: value.last_failure.map(|value| value.as_str().to_owned()),
        }
    }
}
