//! Durable Checkout request reservation and completion.

use diesel::prelude::*;
use mkc_db::schema::billing_commands::billing_checkout_sessions;
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_checkout::{BillingCheckoutSession, BillingCheckoutSessions};
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::billing_rows::checkout::Row;
use crate::queries::PgQueries;

impl BillingCheckoutSessions for PgQueries<'_> {
    fn billing_checkout_session(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Option<BillingCheckoutSession>> {
        Ok(billing_checkout_sessions::table
            .filter(billing_checkout_sessions::organization_id.eq(organization.0))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read billing Checkout request")?
            .map(Row::dto))
    }

    fn reserve_billing_checkout_session(
        &mut self,
        candidate: &BillingCheckoutSession,
    ) -> Result<BillingCheckoutSession> {
        diesel::insert_into(billing_checkout_sessions::table)
            .values(Row::record(candidate))
            .on_conflict(billing_checkout_sessions::organization_id)
            .do_nothing()
            .execute(self.connection)
            .context("reserve billing Checkout request")?;
        self.billing_checkout_session(candidate.organization_id)?
            .ok_or_else(|| {
                mkc_store_interface::error::Error::internal_message(
                    "reserved billing Checkout request was not readable",
                )
            })
    }

    fn save_billing_checkout_session(&mut self, value: &BillingCheckoutSession) -> Result<()> {
        diesel::update(billing_checkout_sessions::table.find(value.id))
            .set(Row::record(value))
            .execute(self.connection)
            .context("save billing Checkout provider session")?;
        Ok(())
    }

    fn delete_billing_checkout_session(&mut self, id: Uuid) -> Result<()> {
        diesel::delete(billing_checkout_sessions::table.find(id))
            .execute(self.connection)
            .context("delete billing Checkout request")?;
        Ok(())
    }
}
