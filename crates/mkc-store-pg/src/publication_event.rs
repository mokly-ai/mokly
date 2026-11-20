//! Durable check delivery and one-use grant queries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types;
use diesel::sql_types::{BigInt, Integer, Nullable, Text, Timestamptz};
use mkc_db::schema::publication_events::{catalogue_grants, publication_events};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::publication_event::{
    CatalogueGrant, EventClaim, EventKind, PendingEvent, PublicationEvent, PublicationEvents,
};
use uuid::Uuid;

use crate::publication_row::InvalidRecord;
use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct EventRow {
    #[diesel(sql_type = sql_types::Uuid)]
    id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    publication_id: Uuid,
    #[diesel(sql_type = Text)]
    kind: String,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<Utc>,
    #[diesel(sql_type = Integer)]
    attempts: i32,
    #[diesel(sql_type = Integer)]
    permanent_failures: i32,
}

impl EventRow {
    fn dto(self) -> Result<PendingEvent> {
        let kind = match self.kind.as_str() {
            "uploading" => EventKind::Uploading,
            "validating" => EventKind::Validating,
            "ready" => EventKind::Ready,
            "failed" => EventKind::Failed,
            "expired" => EventKind::Expired,
            "rerequest" => EventKind::Rerequest,
            _ => return Err(Error::internal(InvalidRecord)),
        };
        Ok(PendingEvent {
            attempts: self.attempts,
            permanent_failures: self.permanent_failures,
            event: PublicationEvent {
                id: self.id,
                publication_id: self.publication_id.into(),
                kind,
                created_at: self.created_at,
            },
        })
    }
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = catalogue_grants)]
struct GrantRow {
    digest: String,
    publication_id: Uuid,
    user_id: Uuid,
    expires_at: DateTime<Utc>,
}

impl GrantRow {
    fn dto(self) -> CatalogueGrant {
        CatalogueGrant {
            digest: self.digest,
            publication_id: self.publication_id.into(),
            user_id: self.user_id.into(),
            expires_at: self.expires_at,
        }
    }
}

impl PublicationEvents for PgQueries<'_> {
    fn dead_letter_count(&mut self) -> Result<i64> {
        publication_events::table
            .filter(publication_events::delivered_at.is_null())
            .filter(publication_events::dead_lettered_at.is_not_null())
            .count()
            .get_result(self.connection)
            .context("count undelivered publication dead letters")
    }

    fn insert_publication_event(&mut self, event: &PublicationEvent) -> Result<()> {
        diesel::insert_into(publication_events::table)
            .values((
                publication_events::id.eq(event.id),
                publication_events::publication_id.eq(event.publication_id.0),
                publication_events::kind.eq(event.kind.as_str()),
                publication_events::created_at.eq(event.created_at),
                publication_events::next_attempt_at.eq(event.created_at),
            ))
            .execute(self.connection)
            .context("append publication event")?;
        Ok(())
    }

    fn pending_publication_events(
        &mut self,
        now: DateTime<Utc>,
        limit: i64,
        project: Option<ProjectId>,
    ) -> Result<Vec<PendingEvent>> {
        diesel::sql_query(include_str!("sql/pending_publication_events.sql"))
            .bind::<Timestamptz, _>(now)
            .bind::<BigInt, _>(limit.clamp(1, 1000))
            .bind::<Nullable<sql_types::Uuid>, _>(project.map(|id| id.0))
            .load::<EventRow>(self.connection)
            .context("read pending check events")?
            .into_iter()
            .map(EventRow::dto)
            .collect()
    }

    fn claim_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        at: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<Option<EventClaim>> {
        Ok(diesel::update(
            publication_events::table
                .find(id)
                .filter(publication_events::delivered_at.is_null())
                .filter(publication_events::dead_lettered_at.is_null())
                .filter(publication_events::next_attempt_at.le(at))
                .filter(publication_events::attempts.eq(attempts))
                .filter(publication_events::kind.eq_any(["ready", "failed", "rerequest"])),
        )
        .set((
            publication_events::attempts.eq(publication_events::attempts + 1),
            publication_events::next_attempt_at.eq(until),
        ))
        .returning((
            publication_events::attempts,
            publication_events::permanent_failures,
        ))
        .get_result::<(i32, i32)>(self.connection)
        .optional()
        .context("claim due publication check")?
        .map(|(attempts, permanent_failures)| EventClaim {
            attempts,
            permanent_failures,
        }))
    }

    fn retry_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        permanent_failures: i32,
        next_attempt_at: DateTime<Utc>,
        dead_lettered_at: Option<DateTime<Utc>>,
    ) -> Result<bool> {
        let changed = diesel::update(
            publication_events::table
                .find(id)
                .filter(publication_events::delivered_at.is_null())
                .filter(publication_events::dead_lettered_at.is_null())
                .filter(publication_events::attempts.eq(attempts)),
        )
        .set((
            publication_events::permanent_failures.eq(permanent_failures),
            publication_events::next_attempt_at.eq(next_attempt_at),
            publication_events::dead_lettered_at.eq(dead_lettered_at),
        ))
        .execute(self.connection)
        .context("record check retry outcome")?;
        Ok(changed == 1)
    }

    fn requeue_publication_event(&mut self, id: Uuid, now: DateTime<Utc>) -> Result<bool> {
        let changed = diesel::update(
            publication_events::table
                .find(id)
                .filter(publication_events::delivered_at.is_null())
                .filter(publication_events::dead_lettered_at.is_not_null())
                .filter(publication_events::kind.eq_any(["ready", "failed", "rerequest"])),
        )
        .set((
            publication_events::attempts.eq(publication_events::attempts + 1),
            publication_events::permanent_failures.eq(0),
            publication_events::next_attempt_at.eq(now),
            publication_events::dead_lettered_at.eq(None::<DateTime<Utc>>),
        ))
        .execute(self.connection)
        .context("requeue undelivered publication check")?;
        Ok(changed == 1)
    }

    fn deliver_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        at: DateTime<Utc>,
    ) -> Result<bool> {
        let changed = diesel::update(
            publication_events::table
                .find(id)
                .filter(publication_events::delivered_at.is_null())
                .filter(publication_events::dead_lettered_at.is_null())
                .filter(publication_events::attempts.eq(attempts)),
        )
        .set(publication_events::delivered_at.eq(at))
        .execute(self.connection)
        .context("acknowledge check delivery")?;
        Ok(changed == 1)
    }

    fn insert_catalogue_grant(&mut self, grant: &CatalogueGrant) -> Result<()> {
        diesel::insert_into(catalogue_grants::table)
            .values((
                catalogue_grants::digest.eq(&grant.digest),
                catalogue_grants::publication_id.eq(grant.publication_id.0),
                catalogue_grants::user_id.eq(grant.user_id.0),
                catalogue_grants::expires_at.eq(grant.expires_at),
            ))
            .execute(self.connection)
            .context("issue one-use catalogue grant")?;
        Ok(())
    }

    fn consume_catalogue_grant(
        &mut self,
        digest: &str,
        publication: PublicationId,
        now: DateTime<Utc>,
    ) -> Result<Option<CatalogueGrant>> {
        Ok(diesel::delete(
            catalogue_grants::table
                .find(digest)
                .filter(catalogue_grants::publication_id.eq(publication.0))
                .filter(catalogue_grants::expires_at.gt(now)),
        )
        .returning(GrantRow::as_returning())
        .get_result(self.connection)
        .optional()
        .context("consume publication-bound access grant")?
        .map(GrantRow::dto))
    }

    fn prune_catalogue_grants(&mut self, now: DateTime<Utc>) -> Result<()> {
        diesel::delete(catalogue_grants::table.filter(catalogue_grants::expires_at.le(now)))
            .execute(self.connection)
            .context("prune expired catalogue grants")?;
        Ok(())
    }
}
