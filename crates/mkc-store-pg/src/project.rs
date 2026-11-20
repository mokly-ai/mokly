//! Diesel queries and row mapping for projects.

use diesel::prelude::*;
use mkc_db::schema::platform::projects;
use mkc_db::schema::slug::project_slugs;
use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_domain::slug::ProjectSlug;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::project::{Project, ProjectLookup, Projects};
use uuid::Uuid;

use crate::blob_locks;
use crate::queries::PgQueries;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = projects)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    organization_id: Uuid,
    name: String,
    slug: String,
    repository: String,
    config_path: String,
    visibility: String,
    require_approval: bool,
    automatic_builds: bool,
    version: i64,
}

impl Row {
    pub(crate) fn dto(self) -> Result<Project> {
        Ok(Project {
            id: self.id.into(),
            organization_id: self.organization_id.into(),
            name: self.name,
            slug: self.slug.parse().context("decode project slug")?,
            repository: self.repository,
            config_path: self.config_path,
            visibility: self.visibility.parse().context("decode visibility")?,
            require_approval: self.require_approval,
            automatic_builds: self.automatic_builds,
            version: self.version,
        })
    }

    fn record(value: &Project) -> Self {
        Self {
            id: value.id.0,
            organization_id: value.organization_id.0,
            name: value.name.clone(),
            slug: value.slug.as_str().to_owned(),
            repository: value.repository.clone(),
            config_path: value.config_path.clone(),
            visibility: value.visibility.as_str().to_owned(),
            require_approval: value.require_approval,
            automatic_builds: value.automatic_builds,
            version: value.version,
        }
    }
}

impl Projects for PgQueries<'_> {
    fn project(&mut self, id: ProjectId) -> Result<Option<Project>> {
        projects::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read projects")?
            .map(Row::dto)
            .transpose()
    }

    fn find_project_by_slug(
        &mut self,
        organization: OrganizationId,
        slug: &ProjectSlug,
    ) -> Result<Option<ProjectLookup>> {
        let id = project_slugs::table
            .filter(project_slugs::organization_id.eq(organization.0))
            .filter(project_slugs::slug.eq(slug.as_str()))
            .select(project_slugs::project_id)
            .first::<Uuid>(self.connection)
            .optional()
            .context("resolve project slug")?;
        let Some(id) = id else {
            return Ok(None);
        };
        Ok(self.project(id.into())?.map(|value| ProjectLookup {
            retired: value.slug != *slug,
            value,
        }))
    }

    fn project_slug_claimed(
        &mut self,
        organization: OrganizationId,
        slug: &ProjectSlug,
    ) -> Result<bool> {
        project_slugs::table
            .filter(project_slugs::organization_id.eq(organization.0))
            .filter(project_slugs::slug.eq(slug.as_str()))
            .select(project_slugs::slug)
            .first::<String>(self.connection)
            .optional()
            .context("check project slug claim")
            .map(|value| value.is_some())
    }

    fn insert_project(&mut self, value: &Project) -> Result<()> {
        claim_slug(self.connection, value)?;
        diesel::insert_into(projects::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert projects")?;
        Ok(())
    }

    fn save_project(&mut self, value: &Project) -> Result<()> {
        claim_slug(self.connection, value)?;
        let row = Row::record(value);
        diesel::update(projects::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update projects")?;
        Ok(())
    }

    fn delete_project(&mut self, id: ProjectId) -> Result<()> {
        self.lock_project_deletion(id)?;
        blob_locks::for_project(self.connection, id)?;
        diesel::delete(projects::table.find(id.0))
            .execute(self.connection)
            .context("delete projects")?;
        Ok(())
    }

    fn projects(&mut self, organization: OrganizationId) -> Result<Vec<Project>> {
        projects::table
            .filter(projects::organization_id.eq(organization.0))
            .order(projects::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list projects")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}

fn claim_slug(connection: &mut PgConnection, value: &Project) -> Result<()> {
    let statement = diesel::insert_into(project_slugs::table)
        .values((
            project_slugs::organization_id.eq(value.organization_id.0),
            project_slugs::slug.eq(value.slug.as_str()),
            project_slugs::project_id.eq(value.id.0),
        ))
        .on_conflict((project_slugs::organization_id, project_slugs::slug))
        .do_update()
        .set(project_slugs::project_id.eq(project_slugs::project_id));
    let claimed = diesel::query_dsl::methods::FilterDsl::filter(
        statement,
        project_slugs::project_id.eq(value.id.0),
    )
    .returning(project_slugs::project_id)
    .get_result::<Uuid>(connection)
    .optional()
    .context("claim project slug")?;
    claimed.map_or(Err(Error::SlugTaken), |_| Ok(()))
}
