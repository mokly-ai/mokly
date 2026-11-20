//! Private Diesel row mapping for durable seat commands.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing_commands::billing_seat_commands;
use mkc_store_interface::billing_seat_command::BillingSeatCommand;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = billing_seat_commands)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    organization_id: Uuid,
    seat_kind: String,
    provider_subscription_id: String,
    operation: String,
    provider_item_id: Option<String>,
    price_id: String,
    quantity: i32,
    idempotency_key: String,
    due_at: DateTime<Utc>,
    attempts: i32,
    lease: Option<Uuid>,
    lease_until: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<BillingSeatCommand> {
        Ok(BillingSeatCommand {
            id: self.id,
            organization_id: self.organization_id.into(),
            seat_kind: self
                .seat_kind
                .parse()
                .context("decode billing_seat_commands seat_kind")?,
            provider_subscription_id: self.provider_subscription_id,
            operation: self
                .operation
                .parse()
                .context("decode billing_seat_commands operation")?,
            provider_item_id: self.provider_item_id,
            price_id: self.price_id,
            quantity: self.quantity,
            idempotency_key: self.idempotency_key,
            due_at: self.due_at,
            attempts: self.attempts,
            lease: self.lease,
            lease_until: self.lease_until,
            created_at: self.created_at,
        })
    }

    pub(crate) fn record(value: &BillingSeatCommand) -> Self {
        Self {
            id: value.id,
            organization_id: value.organization_id.0,
            seat_kind: value.seat_kind.as_str().to_owned(),
            provider_subscription_id: value.provider_subscription_id.clone(),
            operation: value.operation.as_str().to_owned(),
            provider_item_id: value.provider_item_id.clone(),
            price_id: value.price_id.clone(),
            quantity: value.quantity,
            idempotency_key: value.idempotency_key.clone(),
            due_at: value.due_at,
            attempts: value.attempts,
            lease: value.lease,
            lease_until: value.lease_until,
            created_at: value.created_at,
        }
    }
}
