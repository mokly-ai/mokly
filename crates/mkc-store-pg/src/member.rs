//! Diesel queries and row mapping for memberships.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::platform::memberships;
use mkc_domain::ids::{MemberId, OrganizationId, UserId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::member::{Member, Members};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = memberships)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
struct Row {
    id: Uuid,
    organization_id: Uuid,
    user_id: Option<Uuid>,
    email: String,
    role: String,
    version: i64,
    expires_at: Option<DateTime<Utc>>,
}

impl Row {
    fn dto(self) -> Result<Member> {
        Ok(Member {
            id: self.id.into(),
            organization_id: self.organization_id.into(),
            user_id: self.user_id.map(Into::into),
            email: self.email,
            role: self.role.parse().context("decode role")?,
            version: self.version,
            expires_at: self.expires_at,
        })
    }

    fn record(value: &Member) -> Self {
        Self {
            id: value.id.0,
            organization_id: value.organization_id.0,
            user_id: value.user_id.map(|id| id.0),
            email: value.email.clone(),
            role: value.role.as_str().to_owned(),
            version: value.version,
            expires_at: value.expires_at,
        }
    }
}

impl Members for PgQueries<'_> {
    fn member(&mut self, id: MemberId) -> Result<Option<Member>> {
        memberships::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read memberships")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_member(&mut self, value: &Member) -> Result<()> {
        diesel::insert_into(memberships::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert memberships")?;
        Ok(())
    }

    fn save_member(&mut self, value: &Member) -> Result<()> {
        let row = Row::record(value);
        diesel::update(memberships::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update memberships")?;
        Ok(())
    }

    fn delete_member(&mut self, id: MemberId) -> Result<()> {
        diesel::delete(memberships::table.find(id.0))
            .execute(self.connection)
            .context("delete memberships")?;
        Ok(())
    }

    fn members(&mut self, organization: OrganizationId) -> Result<Vec<Member>> {
        memberships::table
            .filter(memberships::organization_id.eq(organization.0))
            .order(memberships::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list memberships")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }

    fn user_memberships(&mut self, user: UserId) -> Result<Vec<Member>> {
        memberships::table
            .filter(memberships::user_id.eq(user.0))
            .order(memberships::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list memberships")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
