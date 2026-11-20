//! Injectable billing application service and shared customer creation.

use std::collections::BTreeMap;
use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_billing::prices::VerifiedPrices;
use mkc_billing_interface::provider::{BillingProvider, CreateCustomer};
use mkc_billing_interface::webhooks::WebhookVerifier;
use mkc_domain::ids::{OrganizationId, UserId};
use mkc_domain::values::Role;
use mkc_store_interface::billing_customer::BillingCustomer;
use mkc_store_interface::store::{Callback, Store};
use thiserror::Error;

use crate::billing::error::{Error, ErrorResultExt, Result};

use super::views::{Billing, HostedSession};

/// Billing behavior used by HTTP dispatch.
#[unimock::unimock(api = [ReadBillingMock, CheckoutMock, PortalMock, AcceptBillingMock])]
pub(crate) trait BillingService: Send + Sync {
    fn read(&self, actor: UserId, workspace: OrganizationId) -> Result<Billing>;
    fn checkout(&self, actor: UserId, workspace: OrganizationId) -> Result<HostedSession>;
    fn portal(&self, actor: UserId, workspace: OrganizationId) -> Result<HostedSession>;
    fn accept(&self, signature: &str, body: &[u8]) -> Result<()>;
}

pub(crate) struct DatabaseBillingService {
    pub(super) store: Arc<dyn Store>,
    pub(super) runtime: Arc<dyn Runtime>,
    pub(super) provider: Arc<dyn BillingProvider>,
    pub(super) verifier: Arc<dyn WebhookVerifier>,
    pub(super) prices: Arc<VerifiedPrices>,
    pub(super) app_origin: String,
}

/// Immutable billing route configuration validated at process startup.
pub(crate) struct BillingServiceConfig {
    /// Canonical application origin used for hosted-session returns.
    pub(crate) app_origin: String,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum Permission {
    Read,
    Manage,
}

pub(crate) fn authorize(role: Role, permission: Permission) -> Result<()> {
    let allowed = match permission {
        Permission::Read => role.can_admin(),
        Permission::Manage => role == Role::Owner,
    };
    if allowed {
        Ok(())
    } else {
        Err(Error::Forbidden)
    }
}

#[derive(Debug, Error)]
#[error("[mkc-api/billing/service] provider returned an empty customer identifier")]
struct EmptyCustomerId;

impl DatabaseBillingService {
    pub(crate) fn new(
        store: Arc<dyn Store>,
        runtime: Arc<dyn Runtime>,
        provider: Arc<dyn BillingProvider>,
        verifier: Arc<dyn WebhookVerifier>,
        prices: Arc<VerifiedPrices>,
        config: BillingServiceConfig,
    ) -> Self {
        Self {
            store,
            runtime,
            provider,
            verifier,
            prices,
            app_origin: config.app_origin,
        }
    }

    pub(super) fn ensure_customer(
        &self,
        workspace: OrganizationId,
        workspace_name: &str,
        owner_email: &str,
        existing: Option<BillingCustomer>,
    ) -> Result<BillingCustomer> {
        if let Some(customer) = existing {
            return Ok(customer);
        }
        let mut metadata = BTreeMap::new();
        metadata.insert("organization_id".to_owned(), workspace.to_string());
        let provider = self
            .provider
            .create_customer(&CreateCustomer {
                name: workspace_name.to_owned(),
                email: owner_email.to_owned(),
                metadata,
            })
            .map_or_else(|error| Err(Error::from_provider(error)), Ok)?;
        if provider.id.is_empty() {
            return Err(Error::internal(EmptyCustomerId));
        }
        let candidate = BillingCustomer {
            organization_id: workspace,
            provider_customer_id: provider.id,
            trial_used_at: None,
            created_at: self.runtime.now(),
            version: 1,
        };
        let mut saved = candidate.clone();
        self.store
            .transaction(&mut Callback(&mut |queries| {
                if let Some(existing) = queries.billing_customer(workspace)? {
                    saved = existing;
                } else {
                    queries.save_billing_customer(&candidate)?;
                    saved = candidate.clone();
                }
                Ok(())
            }))
            .context("save workspace billing customer")?;
        Ok(saved)
    }
}

impl BillingService for DatabaseBillingService {
    fn read(&self, actor: UserId, workspace: OrganizationId) -> Result<Billing> {
        self.read_billing(actor, workspace)
    }

    fn checkout(&self, actor: UserId, workspace: OrganizationId) -> Result<HostedSession> {
        self.start_checkout(actor, workspace)
    }

    fn portal(&self, actor: UserId, workspace: OrganizationId) -> Result<HostedSession> {
        self.open_portal(actor, workspace)
    }

    fn accept(&self, signature: &str, body: &[u8]) -> Result<()> {
        self.accept_webhook(signature, body)
    }
}
