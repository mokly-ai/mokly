//! Diesel queries and row mapping for auth_rate_limits.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::authentication::auth_rate_limits;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::rate_limit::{RateLimit, RateLimits};

use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = auth_rate_limits)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(key))]
struct Row {
    key: String,
    count: i64,
    resets_at: DateTime<Utc>,
}

impl Row {
    fn dto(self) -> Result<RateLimit> {
        Ok(RateLimit {
            key: self.key,
            count: self.count,
            resets_at: self.resets_at,
        })
    }

    fn record(value: &RateLimit) -> Self {
        Self {
            key: value.key.clone(),
            count: value.count,
            resets_at: value.resets_at,
        }
    }
}

impl RateLimits for PgQueries<'_> {
    fn prune_rate_limits(&mut self, before: DateTime<Utc>) -> Result<usize> {
        diesel::delete(auth_rate_limits::table.filter(auth_rate_limits::resets_at.le(before)))
            .execute(self.connection)
            .context("prune retained admission counters")
    }

    fn rate_limit(&mut self, key: &str) -> Result<Option<RateLimit>> {
        auth_rate_limits::table
            .find(key)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read auth_rate_limits")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_rate_limit(&mut self, value: &RateLimit) -> Result<()> {
        diesel::insert_into(auth_rate_limits::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert auth_rate_limits")?;
        Ok(())
    }

    fn save_rate_limit(&mut self, value: &RateLimit) -> Result<()> {
        let row = Row::record(value);
        diesel::update(auth_rate_limits::table.find(&row.key))
            .set(&row)
            .execute(self.connection)
            .context("update auth_rate_limits")?;
        Ok(())
    }
}
