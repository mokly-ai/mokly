//! Billing subscription and seat-item upserts and lookups.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::billing::{billing_subscription_items, billing_subscriptions};
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_subscription::{
    BillingSubscription, BillingSubscriptionItem, BillingSubscriptions,
};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::billing_rows::item::Row as ItemRow;
use crate::billing_rows::subscription::Row as SubscriptionRow;
use crate::queries::PgQueries;

impl BillingSubscriptions for PgQueries<'_> {
    fn billing_subscription(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Option<BillingSubscription>> {
        billing_subscriptions::table
            .find(organization.0)
            .select(SubscriptionRow::as_select())
            .first(self.connection)
            .optional()
            .context("read billing subscription")?
            .map(SubscriptionRow::dto)
            .transpose()
    }

    fn billing_subscription_by_provider_id(
        &mut self,
        provider_subscription_id: &str,
    ) -> Result<Option<BillingSubscription>> {
        billing_subscriptions::table
            .filter(billing_subscriptions::provider_subscription_id.eq(provider_subscription_id))
            .select(SubscriptionRow::as_select())
            .first(self.connection)
            .optional()
            .context("read billing subscription by provider id")?
            .map(SubscriptionRow::dto)
            .transpose()
    }

    fn live_billing_subscriptions(&mut self, limit: i64) -> Result<Vec<BillingSubscription>> {
        billing_subscriptions::table
            .filter(billing_subscriptions::status.eq_any(["trialing", "active", "past_due"]))
            .order((
                billing_subscriptions::seats_checked_at.asc().nulls_first(),
                billing_subscriptions::organization_id.asc(),
            ))
            .limit(limit.clamp(1, 1_000))
            .select(SubscriptionRow::as_select())
            .load(self.connection)
            .context("list live billing subscriptions")?
            .into_iter()
            .map(SubscriptionRow::dto)
            .collect()
    }

    fn mark_seats_checked(
        &mut self,
        organization: OrganizationId,
        checked_at: DateTime<Utc>,
    ) -> Result<()> {
        diesel::update(billing_subscriptions::table.find(organization.0))
            .set(billing_subscriptions::seats_checked_at.eq(checked_at))
            .execute(self.connection)
            .context("mark billing subscription seats checked")?;
        Ok(())
    }

    fn save_billing_subscription(&mut self, value: &BillingSubscription) -> Result<()> {
        let row = SubscriptionRow::record(value);
        diesel::insert_into(billing_subscriptions::table)
            .values(&row)
            .on_conflict(billing_subscriptions::organization_id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save billing subscription")?;
        Ok(())
    }

    fn delete_billing_subscription(&mut self, organization: OrganizationId) -> Result<()> {
        diesel::delete(billing_subscriptions::table.find(organization.0))
            .execute(self.connection)
            .context("delete billing subscription")?;
        Ok(())
    }

    fn billing_subscription_items(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Vec<BillingSubscriptionItem>> {
        billing_subscription_items::table
            .filter(billing_subscription_items::organization_id.eq(organization.0))
            .order(billing_subscription_items::seat_kind.asc())
            .select(ItemRow::as_select())
            .load(self.connection)
            .context("list billing subscription items")?
            .into_iter()
            .map(ItemRow::dto)
            .collect()
    }

    fn save_billing_subscription_item(&mut self, value: &BillingSubscriptionItem) -> Result<()> {
        let row = ItemRow::record(value);
        diesel::insert_into(billing_subscription_items::table)
            .values(&row)
            .on_conflict((
                billing_subscription_items::organization_id,
                billing_subscription_items::seat_kind,
            ))
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save billing subscription item")?;
        Ok(())
    }

    fn delete_billing_subscription_item(&mut self, id: Uuid) -> Result<()> {
        diesel::delete(billing_subscription_items::table.find(id))
            .execute(self.connection)
            .context("delete billing subscription item")?;
        Ok(())
    }
}
