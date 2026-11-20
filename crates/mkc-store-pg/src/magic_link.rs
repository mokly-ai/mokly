//! Diesel queries and row mapping for magic_links.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Timestamptz};
use mkc_db::schema::authentication::magic_links;
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::magic_link::{MagicLink, MagicLinks};

use crate::auth_prune::configure_batch;
use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = magic_links)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(token_hash))]
struct Row {
    token_hash: String,
    email: String,
    return_to: String,
    expires_at: DateTime<Utc>,
    used_at: Option<DateTime<Utc>>,
}

impl Row {
    fn dto(self) -> Result<MagicLink> {
        Ok(MagicLink {
            token_hash: self.token_hash,
            email: self.email,
            return_to: self.return_to,
            expires_at: self.expires_at,
            used_at: self.used_at,
        })
    }

    fn record(value: &MagicLink) -> Self {
        Self {
            token_hash: value.token_hash.clone(),
            email: value.email.clone(),
            return_to: value.return_to.clone(),
            expires_at: value.expires_at,
            used_at: value.used_at,
        }
    }
}

impl MagicLinks for PgQueries<'_> {
    fn prune_magic_links(&mut self, before: DateTime<Utc>, batch: PruneBatch) -> Result<usize> {
        let limit = configure_batch(self.connection, batch)?;
        diesel::sql_query(include_str!("magic_link_retention.sql"))
            .bind::<Timestamptz, _>(before)
            .bind::<BigInt, _>(limit)
            .execute(self.connection)
            .context("prune retained magic links")
    }

    fn magic_link(&mut self, token_hash: &str) -> Result<Option<MagicLink>> {
        magic_links::table
            .find(token_hash)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read magic_links")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_magic_link(&mut self, value: &MagicLink) -> Result<()> {
        diesel::insert_into(magic_links::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert magic_links")?;
        Ok(())
    }

    fn save_magic_link(&mut self, value: &MagicLink) -> Result<()> {
        let row = Row::record(value);
        diesel::update(magic_links::table.find(&row.token_hash))
            .set(&row)
            .execute(self.connection)
            .context("update magic_links")?;
        Ok(())
    }
}
