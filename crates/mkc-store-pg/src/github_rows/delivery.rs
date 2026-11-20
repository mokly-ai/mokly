//! Private Diesel row mapping for github_webhook_deliveries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_delivery::github_webhook_deliveries;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_delivery::Delivery;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_webhook_deliveries)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
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
    pub(crate) fn dto(self) -> Result<Delivery> {
        Ok(Delivery {
            id: self.id,
            event: self.event,
            body: self.body,
            received_at: self.received_at,
            due_at: self.due_at,
            attempts: self.attempts,
            status: self
                .status
                .parse()
                .context("decode github_webhook_deliveries status")?,
            lease: self.lease,
            lease_until: self.lease_until,
            last_failure: self
                .last_failure
                .map(|value| {
                    value
                        .parse()
                        .context("decode github_webhook_deliveries last_failure")
                })
                .transpose()?,
        })
    }

    pub(crate) fn record(value: &Delivery) -> Self {
        Self {
            id: value.id,
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
