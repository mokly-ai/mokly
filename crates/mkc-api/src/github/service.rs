//! Trait-backed GitHub account, installation and delivery policy.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_auth::service::{Identity, LinkVerified};
use mkc_domain::ids::{InstallationId, OrganizationId, UserId};
use mkc_github_interface::credentials::Tokens;
use mkc_github_interface::identity::Identities;
use mkc_github_interface::repositories::Repositories;
use mkc_github_interface::webhooks::WebhookVerifier;
use mkc_store_interface::github_state::FlowPurpose;
use mkc_store_interface::store::Store;

use crate::error::Result;

use super::input::{Callback, IncomingDelivery, InstallationCallback};
use super::views::{Connection, Installation, Repository};

#[unimock::unimock(api = [StartFlowMock, InstallationCallbackMock, CallbackMock, DisconnectMock, DisconnectInstallationMock, ListInstallationsMock, ListRepositoriesMock, AcceptDeliveryMock])]
pub(crate) trait GitHubIntegration: Send + Sync {
    fn start(
        &self,
        identity: Option<&Identity>,
        purpose: FlowPurpose,
        workspace: Option<OrganizationId>,
        installation_id: Option<i64>,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<Connection>;
    fn installation_callback(
        &self,
        identity: &Identity,
        input: InstallationCallback,
    ) -> Result<Connection>;
    fn callback(
        &self,
        identity: Option<&Identity>,
        input: Callback,
        previous: Option<&str>,
        csrf: Option<&str>,
    ) -> Result<LinkVerified>;
    fn disconnect(&self, actor: UserId) -> Result<()>;
    fn disconnect_installation(&self, actor: UserId, installation: InstallationId) -> Result<()>;
    fn installations(
        &self,
        actor: UserId,
        workspace: Option<OrganizationId>,
    ) -> Result<Vec<Installation>>;
    fn repositories(&self, actor: UserId, installation: InstallationId) -> Result<Vec<Repository>>;
    fn accept(&self, delivery: IncomingDelivery) -> Result<()>;
}

pub(crate) struct Navigation {
    pub(crate) app_origin: String,
    pub(crate) web_origin: String,
    pub(crate) client_id: String,
    pub(crate) app_slug: String,
    pub(crate) app_id: i64,
}

pub(crate) struct GitHubService {
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
    pub(crate) identities: Arc<dyn Identities>,
    pub(crate) repositories: Arc<dyn Repositories>,
    pub(crate) tokens: Arc<dyn Tokens>,
    pub(crate) verifier: Arc<dyn WebhookVerifier>,
    pub(crate) navigation: Navigation,
}

impl GitHubIntegration for GitHubService {
    fn start(
        &self,
        identity: Option<&Identity>,
        purpose: FlowPurpose,
        workspace: Option<OrganizationId>,
        installation_id: Option<i64>,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<Connection> {
        self.start_flow(
            identity,
            purpose,
            workspace,
            installation_id,
            return_to,
            peer,
        )
    }

    fn installation_callback(
        &self,
        identity: &Identity,
        input: InstallationCallback,
    ) -> Result<Connection> {
        self.prepare_installation(identity, input)
    }

    fn callback(
        &self,
        identity: Option<&Identity>,
        input: Callback,
        previous: Option<&str>,
        csrf: Option<&str>,
    ) -> Result<LinkVerified> {
        self.finish_callback(identity, input, previous, csrf)
    }

    fn disconnect(&self, actor: UserId) -> Result<()> {
        self.disconnect_identity(actor)
    }

    fn disconnect_installation(&self, actor: UserId, installation: InstallationId) -> Result<()> {
        self.remove_installation(actor, installation)
    }

    fn installations(
        &self,
        actor: UserId,
        workspace: Option<OrganizationId>,
    ) -> Result<Vec<Installation>> {
        self.list_installations(actor, workspace)
    }

    fn repositories(&self, actor: UserId, installation: InstallationId) -> Result<Vec<Repository>> {
        self.list_repositories(actor, installation)
    }

    fn accept(&self, delivery: IncomingDelivery) -> Result<()> {
        self.accept_delivery(delivery)
    }
}
