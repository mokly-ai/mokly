//! Installation lookups and metadata writes; authorization lives in services.

use diesel::prelude::*;
use mkc_db::schema::github_installation::github_installations;
use mkc_domain::ids::{InstallationId, OrganizationId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_installation::{GitHubInstallations, Installation};

use crate::github_rows::installation::Row;
use crate::queries::PgQueries;

impl GitHubInstallations for PgQueries<'_> {
    fn github_installation(&mut self, id: InstallationId) -> Result<Option<Installation>> {
        github_installations::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub installation")?
            .map(Row::dto)
            .transpose()
    }

    fn github_installation_by_provider(&mut self, id: i64) -> Result<Option<Installation>> {
        github_installations::table
            .filter(github_installations::github_id.eq(id))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("find GitHub installation")?
            .map(Row::dto)
            .transpose()
    }

    fn github_installations(&mut self, organization: OrganizationId) -> Result<Vec<Installation>> {
        github_installations::table
            .filter(github_installations::organization_id.eq(organization.0))
            .order(github_installations::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list GitHub installations")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }

    fn save_github_installation(&mut self, value: &Installation) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(github_installations::table)
            .values(&row)
            .on_conflict(github_installations::id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub installation")?;
        Ok(())
    }
}
