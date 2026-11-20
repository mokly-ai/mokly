//! Diesel queries and row mapping for project_grants.

use diesel::prelude::*;
use mkc_db::schema::platform::project_grants;
use mkc_domain::ids::{GrantId, ProjectId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::grant::{Grant, Grants};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = project_grants)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
struct Row {
    id: Uuid,
    project_id: Uuid,
    user_id: Uuid,
    role: String,
    version: i64,
}

impl Row {
    fn dto(self) -> Result<Grant> {
        Ok(Grant {
            id: self.id.into(),
            project_id: self.project_id.into(),
            user_id: self.user_id.into(),
            role: self.role.parse().context("decode role")?,
            version: self.version,
        })
    }

    fn record(value: &Grant) -> Self {
        Self {
            id: value.id.0,
            project_id: value.project_id.0,
            user_id: value.user_id.0,
            role: value.role.as_str().to_owned(),
            version: value.version,
        }
    }
}

impl Grants for PgQueries<'_> {
    fn grant(&mut self, id: GrantId) -> Result<Option<Grant>> {
        project_grants::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read project_grants")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_grant(&mut self, value: &Grant) -> Result<()> {
        diesel::insert_into(project_grants::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert project_grants")?;
        Ok(())
    }

    fn save_grant(&mut self, value: &Grant) -> Result<()> {
        let row = Row::record(value);
        diesel::update(project_grants::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update project_grants")?;
        Ok(())
    }

    fn delete_grant(&mut self, id: GrantId) -> Result<()> {
        diesel::delete(project_grants::table.find(id.0))
            .execute(self.connection)
            .context("delete project_grants")?;
        Ok(())
    }

    fn grants(&mut self, project: ProjectId) -> Result<Vec<Grant>> {
        project_grants::table
            .filter(project_grants::project_id.eq(project.0))
            .order(project_grants::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list project_grants")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
