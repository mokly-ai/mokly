//! Private Diesel row mapping for billing_subscription_items.

use diesel::prelude::*;
use mkc_db::schema::billing::billing_subscription_items;
use mkc_store_interface::billing_subscription::BillingSubscriptionItem;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = billing_subscription_items)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    organization_id: Uuid,
    seat_kind: String,
    provider_item_id: String,
    price_id: String,
    quantity: i32,
}

impl Row {
    pub(crate) fn dto(self) -> Result<BillingSubscriptionItem> {
        Ok(BillingSubscriptionItem {
            id: self.id,
            organization_id: self.organization_id.into(),
            seat_kind: self
                .seat_kind
                .parse()
                .context("decode billing_subscription_items seat_kind")?,
            provider_item_id: self.provider_item_id,
            price_id: self.price_id,
            quantity: self.quantity,
        })
    }

    pub(crate) fn record(value: &BillingSubscriptionItem) -> Self {
        Self {
            id: value.id,
            organization_id: value.organization_id.0,
            seat_kind: value.seat_kind.as_str().to_owned(),
            provider_item_id: value.provider_item_id.clone(),
            price_id: value.price_id.clone(),
            quantity: value.quantity,
        }
    }
}
