//! Durable billing queue statements with lease fencing and crash recovery.

use chrono::{DateTime, Utc};
use diesel::dsl::count_star;
use diesel::prelude::*;
use diesel::sql_types::{Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::billing::billing_deliveries;
use mkc_store_interface::billing_delivery::{BillingDeliveries, BillingDelivery};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::billing_rows::delivery::Row;
use crate::queries::PgQueries;

impl BillingDeliveries for PgQueries<'_> {
    fn billing_delivery(&mut self, id: &str) -> Result<Option<BillingDelivery>> {
        billing_deliveries::table
            .find(id)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read billing delivery")?
            .map(Row::dto)
            .transpose()
    }

    fn save_billing_delivery(&mut self, value: &BillingDelivery) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(billing_deliveries::table)
            .values(&row)
            .on_conflict(billing_deliveries::id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save billing delivery")?;
        Ok(())
    }

    fn claim_billing_delivery(
        &mut self,
        now: DateTime<Utc>,
        lease: Uuid,
        until: DateTime<Utc>,
    ) -> Result<Option<BillingDelivery>> {
        diesel::sql_query(
            "WITH candidate AS (
                SELECT id FROM billing_deliveries
                WHERE attempts < 8 AND ((status = 'pending' AND due_at <= $1)
                    OR (status = 'processing' AND lease_until <= $1))
                ORDER BY received_at, id FOR UPDATE SKIP LOCKED LIMIT 1
             ) UPDATE billing_deliveries d
             SET status = 'processing', attempts = attempts + 1, lease = $2, lease_until = $3
             FROM candidate WHERE d.id = candidate.id RETURNING d.*",
        )
        .bind::<Timestamptz, _>(now)
        .bind::<SqlUuid, _>(lease)
        .bind::<Timestamptz, _>(until)
        .get_result::<Row>(self.connection)
        .optional()
        .context("claim billing delivery")?
        .map(Row::dto)
        .transpose()
    }

    fn expire_billing_deliveries(&mut self, now: DateTime<Utc>) -> Result<()> {
        diesel::update(
            billing_deliveries::table
                .filter(billing_deliveries::status.eq("processing"))
                .filter(billing_deliveries::lease_until.le(now))
                .filter(billing_deliveries::attempts.ge(8)),
        )
        .set((
            billing_deliveries::status.eq("failed"),
            billing_deliveries::lease.eq(None::<Uuid>),
            billing_deliveries::lease_until.eq(None::<DateTime<Utc>>),
            billing_deliveries::last_failure.eq(Some("internal")),
        ))
        .execute(self.connection)
        .context("expire exhausted billing delivery leases")?;
        Ok(())
    }

    fn billing_dead_letter_count(&mut self) -> Result<i64> {
        billing_deliveries::table
            .filter(billing_deliveries::status.eq("failed"))
            .select(count_star())
            .first(self.connection)
            .context("count failed billing deliveries")
    }
}
