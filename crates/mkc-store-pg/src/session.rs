//! Diesel queries and row mapping for sessions.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Timestamptz};
use mkc_db::schema::authentication::sessions;
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::session::{Session, Sessions};
use uuid::Uuid;

use crate::auth_prune::configure_batch;
use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = sessions)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(token_hash))]
struct Row {
    token_hash: String,
    user_id: Uuid,
    csrf_token: String,
    created_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
}

impl Row {
    fn dto(self) -> Result<Session> {
        Ok(Session {
            token_hash: self.token_hash,
            user_id: self.user_id.into(),
            csrf_token: self.csrf_token,
            created_at: self.created_at,
            expires_at: self.expires_at,
            last_seen_at: self.last_seen_at,
        })
    }

    fn record(value: &Session) -> Self {
        Self {
            token_hash: value.token_hash.clone(),
            user_id: value.user_id.0,
            csrf_token: value.csrf_token.clone(),
            created_at: value.created_at,
            expires_at: value.expires_at,
            last_seen_at: value.last_seen_at,
        }
    }
}

impl Sessions for PgQueries<'_> {
    fn prune_sessions(
        &mut self,
        expires_before: DateTime<Utc>,
        seen_before: DateTime<Utc>,
        batch: PruneBatch,
    ) -> Result<usize> {
        let limit = configure_batch(self.connection, batch)?;
        diesel::sql_query(include_str!("session_retention.sql"))
            .bind::<Timestamptz, _>(expires_before)
            .bind::<Timestamptz, _>(seen_before)
            .bind::<BigInt, _>(limit)
            .execute(self.connection)
            .context("prune retained sessions")
    }

    fn session(&mut self, token_hash: &str) -> Result<Option<Session>> {
        sessions::table
            .find(token_hash)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read sessions")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_session(&mut self, value: &Session) -> Result<()> {
        diesel::insert_into(sessions::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert sessions")?;
        Ok(())
    }

    fn delete_session(&mut self, token_hash: &str) -> Result<()> {
        diesel::delete(sessions::table.find(token_hash))
            .execute(self.connection)
            .context("delete sessions")?;
        Ok(())
    }

    fn touch(&mut self, hash: &str, now: DateTime<Utc>, before: DateTime<Utc>) -> Result<()> {
        diesel::update(
            sessions::table
                .filter(sessions::token_hash.eq(hash))
                .filter(sessions::last_seen_at.lt(before)),
        )
        .set(sessions::last_seen_at.eq(now))
        .execute(self.connection)
        .context("touch session activity")?;
        Ok(())
    }
}
