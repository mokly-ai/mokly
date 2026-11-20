//! Billing customer upserts and identity lookups.

use diesel::prelude::*;
use mkc_db::schema::billing::billing_customers;
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_customer::{BillingCustomer, BillingCustomers};
use mkc_store_interface::error::{ErrorResultExt, Result};

use crate::billing_rows::customer::Row;
use crate::queries::PgQueries;

impl BillingCustomers for PgQueries<'_> {
    fn billing_customer(
        &mut self,
        organization: OrganizationId,
    ) -> Result<Option<BillingCustomer>> {
        Ok(billing_customers::table
            .find(organization.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read billing customer")?
            .map(Row::dto))
    }

    fn billing_customer_by_provider_id(
        &mut self,
        provider_customer_id: &str,
    ) -> Result<Option<BillingCustomer>> {
        Ok(billing_customers::table
            .filter(billing_customers::provider_customer_id.eq(provider_customer_id))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read billing customer by provider id")?
            .map(Row::dto))
    }

    fn save_billing_customer(&mut self, value: &BillingCustomer) -> Result<()> {
        let row = Row::record(value);
        diesel::insert_into(billing_customers::table)
            .values(&row)
            .on_conflict(billing_customers::organization_id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save billing customer")?;
        Ok(())
    }
}
