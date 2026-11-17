//! Owner-only Customer Portal session creation.

use mkc_domain::app_paths;
use mkc_domain::ids::{OrganizationId, UserId};
use mkc_domain::values::Role;
use mkc_store_interface::store::Callback;

use crate::billing::error::{Error, ErrorResultExt, Result};

use super::service::{DatabaseBillingService, Permission, authorize};
use super::views::HostedSession;

impl DatabaseBillingService {
    pub(super) fn open_portal(
        &self,
        actor: UserId,
        workspace: OrganizationId,
    ) -> Result<HostedSession> {
        let mut workspace_record = None;
        let mut role = None;
        let mut owner = None;
        let mut customer = None;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                workspace_record = queries.organization(workspace)?;
                role = queries
                    .members(workspace)?
                    .into_iter()
                    .find(|member| member.user_id == Some(actor))
                    .map(|member| member.role);
                if role == Some(Role::Owner) {
                    owner = queries.user(actor)?;
                    customer = queries.billing_customer(workspace)?;
                }
                Ok(())
            }))
            .context("read Customer Portal policy")?;
        let workspace_record = workspace_record.ok_or(Error::NotFound)?;
        match role {
            None => return Err(Error::NotFound),
            Some(role) => authorize(role, Permission::Manage)?,
        }
        let owner = owner.ok_or(Error::NotFound)?;
        let customer =
            self.ensure_customer(workspace, &workspace_record.name, &owner.email, customer)?;
        let session = self
            .provider
            .create_portal_session(
                &customer.provider_customer_id,
                &app_paths::on_origin(
                    &self.app_origin,
                    &app_paths::workspace_billing(&workspace_record.slug),
                ),
                &format!("portal:{workspace}:{}", self.runtime.id()),
            )
            .map_or_else(|error| Err(Error::from_provider(error)), Ok)?;
        Ok(HostedSession { url: session.url })
    }
}
