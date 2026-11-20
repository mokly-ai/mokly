//! Read persisted provider identities for account and organization projections.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::integration::integrations;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::integration::{Integration, IntegrationSubject, Integrations};

use crate::queries::PgQueries;

impl Integrations for PgQueries<'_> {
    fn integration(&mut self, subject: IntegrationSubject) -> Result<Option<Integration>> {
        let (kind, id) = match subject {
            IntegrationSubject::User(id) => ("user", id.0),
            IntegrationSubject::Organization(id) => ("organization", id.0),
        };
        let account = integrations::table
            .find((kind, id))
            .filter(integrations::provider.eq("github"))
            .select(integrations::account_name)
            .first::<String>(self.connection)
            .optional()
            .context("read provider integration")?;
        Ok(account.map(|account| Integration { account }))
    }

    fn save_integration(
        &mut self,
        subject: IntegrationSubject,
        account: &str,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let (kind, id) = match subject {
            IntegrationSubject::User(id) => ("user", id.0),
            IntegrationSubject::Organization(id) => ("organization", id.0),
        };
        diesel::insert_into(integrations::table)
            .values((
                integrations::subject_kind.eq(kind),
                integrations::subject_id.eq(id),
                integrations::provider.eq("github"),
                integrations::account_name.eq(account),
                integrations::created_at.eq(now),
            ))
            .on_conflict((integrations::subject_kind, integrations::subject_id))
            .do_update()
            .set(integrations::account_name.eq(account))
            .execute(self.connection)
            .context("save provider integration")?;
        Ok(())
    }

    fn delete_integration(&mut self, subject: IntegrationSubject) -> Result<()> {
        let (kind, id) = match subject {
            IntegrationSubject::User(id) => ("user", id.0),
            IntegrationSubject::Organization(id) => ("organization", id.0),
        };
        diesel::delete(
            integrations::table
                .find((kind, id))
                .filter(integrations::provider.eq("github")),
        )
        .execute(self.connection)
        .context("delete provider integration")?;
        Ok(())
    }
}
