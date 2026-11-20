//! Desktop grant rows locked before challenge validation and conditional consumption.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Timestamptz};
use mkc_db::schema::desktop_grant::desktop_grants;
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::desktop_grant::{DesktopGrant, DesktopGrants};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::auth_prune::configure_batch;
use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = desktop_grants)]
struct Row {
    token_hash: String,
    challenge: String,
    user_id: Uuid,
    return_to: String,
    expires_at: DateTime<Utc>,
    session_expires_at: DateTime<Utc>,
    used_at: Option<DateTime<Utc>>,
}

impl From<Row> for DesktopGrant {
    fn from(row: Row) -> Self {
        Self {
            token_hash: row.token_hash,
            challenge: row.challenge,
            user_id: row.user_id.into(),
            return_to: row.return_to,
            expires_at: row.expires_at,
            session_expires_at: row.session_expires_at,
            used_at: row.used_at,
        }
    }
}

impl DesktopGrants for PgQueries<'_> {
    fn insert_desktop_grant(&mut self, value: &DesktopGrant) -> Result<()> {
        diesel::insert_into(desktop_grants::table)
            .values(Row {
                token_hash: value.token_hash.clone(),
                challenge: value.challenge.clone(),
                user_id: value.user_id.0,
                return_to: value.return_to.clone(),
                expires_at: value.expires_at,
                session_expires_at: value.session_expires_at,
                used_at: value.used_at,
            })
            .execute(self.connection)
            .context("insert desktop grant")?;
        Ok(())
    }

    fn desktop_grant(&mut self, token_hash: &str) -> Result<Option<DesktopGrant>> {
        Ok(desktop_grants::table
            .find(token_hash)
            .for_update()
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("lock desktop grant")?
            .map(DesktopGrant::from))
    }

    fn consume_desktop_grant(&mut self, token_hash: &str, now: DateTime<Utc>) -> Result<bool> {
        let changed = diesel::update(
            desktop_grants::table
                .find(token_hash)
                .filter(desktop_grants::used_at.is_null())
                .filter(desktop_grants::expires_at.gt(now))
                .filter(desktop_grants::session_expires_at.gt(now)),
        )
        .set(desktop_grants::used_at.eq(now))
        .execute(self.connection)
        .context("consume desktop grant")?;
        Ok(changed == 1)
    }

    fn prune_desktop_grants(&mut self, before: DateTime<Utc>, batch: PruneBatch) -> Result<usize> {
        let limit = configure_batch(self.connection, batch)?;
        diesel::sql_query(include_str!("desktop_grant_retention.sql"))
            .bind::<Timestamptz, _>(before)
            .bind::<BigInt, _>(limit)
            .execute(self.connection)
            .context("prune desktop grants")
    }
}
