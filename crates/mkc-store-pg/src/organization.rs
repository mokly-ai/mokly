//! Diesel queries and row mapping for organizations.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use mkc_db::schema::platform::organizations;
use mkc_db::schema::slug::organization_slugs;
use mkc_domain::ids::OrganizationId;
use mkc_domain::slug::WorkspaceSlug;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::organization::{
    Organization, OrganizationLookup, Organizations, SeatCounts,
};
use uuid::Uuid;

use crate::blob_locks;
use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = organizations)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
struct Row {
    id: Uuid,
    name: String,
    slug: String,
    version: i64,
    created_at: DateTime<Utc>,
    plan: String,
}

#[derive(QueryableByName)]
struct SeatCountsRow {
    #[diesel(sql_type = BigInt)]
    editors: i64,
    #[diesel(sql_type = BigInt)]
    collaborators: i64,
}

impl Row {
    fn dto(self) -> Result<Organization> {
        Ok(Organization {
            id: self.id.into(),
            name: self.name,
            slug: self.slug.parse().context("decode organization slug")?,
            version: self.version,
            created_at: self.created_at,
            plan: self.plan.parse().context("decode plan")?,
        })
    }

    fn record(value: &Organization) -> Self {
        Self {
            id: value.id.0,
            name: value.name.clone(),
            slug: value.slug.as_str().to_owned(),
            version: value.version,
            created_at: value.created_at,
            plan: value.plan.as_str().to_owned(),
        }
    }
}

impl Organizations for PgQueries<'_> {
    fn organization(&mut self, id: OrganizationId) -> Result<Option<Organization>> {
        organizations::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read organizations")?
            .map(Row::dto)
            .transpose()
    }

    fn find_organization_by_slug(
        &mut self,
        slug: &WorkspaceSlug,
    ) -> Result<Option<OrganizationLookup>> {
        let id = organization_slugs::table
            .filter(organization_slugs::slug.eq(slug.as_str()))
            .select(organization_slugs::organization_id)
            .first::<Uuid>(self.connection)
            .optional()
            .context("resolve organization slug")?;
        let Some(id) = id else {
            return Ok(None);
        };
        Ok(self
            .organization(id.into())?
            .map(|value| OrganizationLookup {
                retired: value.slug != *slug,
                value,
            }))
    }

    fn organization_slug_claimed(&mut self, slug: &WorkspaceSlug) -> Result<bool> {
        organization_slugs::table
            .filter(organization_slugs::slug.eq(slug.as_str()))
            .select(organization_slugs::slug)
            .first::<String>(self.connection)
            .optional()
            .context("check organization slug claim")
            .map(|value| value.is_some())
    }

    fn insert_organization(&mut self, value: &Organization) -> Result<()> {
        claim_slug(self.connection, value)?;
        diesel::insert_into(organizations::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert organizations")?;
        Ok(())
    }

    fn save_organization(&mut self, value: &Organization) -> Result<()> {
        claim_slug(self.connection, value)?;
        let row = Row::record(value);
        diesel::update(organizations::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update organizations")?;
        Ok(())
    }

    fn delete_organization(&mut self, id: OrganizationId) -> Result<()> {
        self.lock_organization_deletion(id)?;
        blob_locks::for_organization(self.connection, id)?;
        diesel::delete(organizations::table.find(id.0))
            .execute(self.connection)
            .context("delete organizations")?;
        Ok(())
    }

    fn seat_counts(&mut self, organization: OrganizationId) -> Result<SeatCounts> {
        let row = diesel::sql_query(
            "WITH assigned AS (
                SELECT user_id, CASE WHEN role = 'reviewer' THEN 1 ELSE 2 END AS strength
                FROM memberships
                WHERE organization_id = $1 AND user_id IS NOT NULL
                UNION ALL
                SELECT grants.user_id,
                    CASE WHEN grants.role = 'reviewer' THEN 1 ELSE 2 END AS strength
                FROM project_grants grants
                INNER JOIN projects ON projects.id = grants.project_id
                WHERE projects.organization_id = $1
             ), strongest AS (
                SELECT user_id, MAX(strength) AS strength
                FROM assigned GROUP BY user_id
             ) SELECT
                COUNT(*) FILTER (WHERE strength = 2)::bigint AS editors,
                COUNT(*) FILTER (WHERE strength = 1)::bigint AS collaborators
             FROM strongest",
        )
        .bind::<diesel::sql_types::Uuid, _>(organization.0)
        .get_result::<SeatCountsRow>(self.connection)
        .context("count organization billing seats")?;
        Ok(SeatCounts {
            editors: row.editors,
            collaborators: row.collaborators,
        })
    }
}

fn claim_slug(connection: &mut PgConnection, value: &Organization) -> Result<()> {
    let statement = diesel::insert_into(organization_slugs::table)
        .values((
            organization_slugs::slug.eq(value.slug.as_str()),
            organization_slugs::organization_id.eq(value.id.0),
        ))
        .on_conflict(organization_slugs::slug)
        .do_update()
        .set(organization_slugs::organization_id.eq(organization_slugs::organization_id));
    let claimed = diesel::query_dsl::methods::FilterDsl::filter(
        statement,
        organization_slugs::organization_id.eq(value.id.0),
    )
    .returning(organization_slugs::organization_id)
    .get_result::<Uuid>(connection)
    .optional()
    .context("claim organization slug")?;
    claimed.map_or(Err(Error::SlugTaken), |_| Ok(()))
}
