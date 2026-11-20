//! Durable queue statements with lease fencing and crash recovery.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::github_delivery::github_webhook_deliveries;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_delivery::{Delivery, GitHubDeliveries};
use uuid::Uuid;

use crate::github_rows::delivery::Row;
use crate::queries::PgQueries;

impl GitHubDeliveries for PgQueries<'_> {
    fn github_delivery(&mut self, id: Uuid) -> Result<Option<Delivery>> {
        github_webhook_deliveries::table
            .find(id)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub delivery")?
            .map(Row::dto)
            .transpose()
    }

    fn save_github_delivery(&mut self, value: &Delivery) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(github_webhook_deliveries::table)
            .values(&row)
            .on_conflict(github_webhook_deliveries::id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub delivery")?;
        Ok(())
    }

    fn claim_github_delivery(
        &mut self,
        now: DateTime<Utc>,
        lease: Uuid,
        until: DateTime<Utc>,
    ) -> Result<Option<Delivery>> {
        diesel::sql_query(
            "WITH candidate AS (
                SELECT id FROM github_webhook_deliveries
                WHERE attempts < 8 AND ((status = 'pending' AND due_at <= $1)
                    OR (status = 'processing' AND lease_until <= $1))
                ORDER BY received_at, id FOR UPDATE SKIP LOCKED LIMIT 1
             ) UPDATE github_webhook_deliveries d
             SET status = 'processing', attempts = attempts + 1, lease = $2, lease_until = $3
             FROM candidate WHERE d.id = candidate.id RETURNING d.*",
        )
        .bind::<Timestamptz, _>(now)
        .bind::<SqlUuid, _>(lease)
        .bind::<Timestamptz, _>(until)
        .get_result::<Row>(self.connection)
        .optional()
        .context("claim GitHub delivery")?
        .map(Row::dto)
        .transpose()
    }

    fn expire_github_deliveries(&mut self, now: DateTime<Utc>) -> Result<()> {
        diesel::update(
            github_webhook_deliveries::table
                .filter(github_webhook_deliveries::status.eq("processing"))
                .filter(github_webhook_deliveries::lease_until.le(now))
                .filter(github_webhook_deliveries::attempts.ge(8)),
        )
        .set((
            github_webhook_deliveries::status.eq("failed"),
            github_webhook_deliveries::lease.eq(None::<Uuid>),
            github_webhook_deliveries::lease_until.eq(None::<DateTime<Utc>>),
            github_webhook_deliveries::last_failure.eq(Some("internal")),
        ))
        .execute(self.connection)
        .context("expire exhausted GitHub delivery leases")?;
        Ok(())
    }
}
