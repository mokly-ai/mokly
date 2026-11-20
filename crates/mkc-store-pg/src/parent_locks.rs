//! Parent cascades acquire each higher level before their canonical blob pre-locks.

use diesel::prelude::*;
use diesel::sql_types::{Array, Uuid as SqlUuid};
use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Locked {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(crate) fn lock_project_deletion(&mut self, project: ProjectId) -> Result<()> {
        let projects = diesel::sql_query("SELECT id FROM projects WHERE id = $1 FOR UPDATE")
            .bind::<SqlUuid, _>(project.0)
            .load::<Locked>(self.connection)
            .context("lock deleting project before its children")?;
        self.lock_parent_children(&projects.into_iter().map(|row| row.id).collect::<Vec<_>>())
    }

    pub(crate) fn lock_organization_deletion(
        &mut self,
        organization: OrganizationId,
    ) -> Result<()> {
        diesel::sql_query("SELECT id FROM organizations WHERE id = $1 FOR UPDATE")
            .bind::<SqlUuid, _>(organization.0)
            .load::<Locked>(self.connection)
            .context("lock deleting organization before its projects")?;
        let projects = diesel::sql_query(
            "SELECT id FROM projects WHERE organization_id = $1 ORDER BY id FOR UPDATE",
        )
        .bind::<SqlUuid, _>(organization.0)
        .load::<Locked>(self.connection)
        .context("lock every deleting project before its builds")?;
        self.lock_parent_children(&projects.into_iter().map(|row| row.id).collect::<Vec<_>>())
    }

    fn lock_parent_children(&mut self, projects: &[Uuid]) -> Result<()> {
        for statement in [
            "SELECT id FROM builds WHERE project_id = ANY($1)
             OR superseded_by IN (SELECT id FROM builds WHERE project_id = ANY($1))
             OR publication_id IN (SELECT id FROM publications WHERE project_id = ANY($1))
             ORDER BY id FOR UPDATE",
            "SELECT g.id FROM build_upload_grants g JOIN builds b ON b.id = g.build_id
             WHERE b.project_id = ANY($1) ORDER BY g.id FOR UPDATE OF g",
            "SELECT id FROM publications WHERE project_id = ANY($1) ORDER BY id FOR UPDATE",
        ] {
            diesel::sql_query(statement)
                .bind::<Array<SqlUuid>, _>(projects)
                .load::<Locked>(self.connection)
                .context("lock parent cascade builds, grants and publications before blobs")?;
        }
        Ok(())
    }
}
