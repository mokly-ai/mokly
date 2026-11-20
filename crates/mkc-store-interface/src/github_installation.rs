//! GitHub installation persistence and cloud organization binding.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{InstallationId, OrganizationId};

use crate::error::Result;
use crate::github_state::AccountKind;

/// Persisted installation metadata; provider IDs never authorize cloud access.
#[derive(Clone, Debug)]
pub struct Installation {
    /// Opaque cloud identity.
    pub id: InstallationId,
    /// Stable GitHub installation ID.
    pub github_id: i64,
    /// Owning GitHub App ID.
    pub app_id: i64,
    /// Cloud organization after verified linking.
    pub organization_id: Option<OrganizationId>,
    /// Stable GitHub account ID.
    pub account_id: i64,
    /// Current GitHub login or organization name.
    pub account_name: String,
    /// Installation owner category.
    pub account_kind: AccountKind,
    /// GitHub installation settings URL.
    pub manage_url: String,
    /// Provider access is currently available.
    pub active: bool,
    /// Cloud administrator has connected this installation.
    pub connected: bool,
    /// Last provider reconciliation time.
    pub updated_at: DateTime<Utc>,
}

/// The current availability of an organization's installation binding.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InstallationState {
    /// Bound locally and available from the provider.
    Connected,
    /// Bound locally but suspended by the provider.
    Suspended,
    /// No connected organization binding, including a local disconnect.
    Absent,
}

impl Installation {
    /// Classify the binding independently of installation-list eligibility.
    pub fn state(&self) -> InstallationState {
        if self.organization_id.is_none() || !self.connected {
            InstallationState::Absent
        } else if self.active {
            InstallationState::Connected
        } else {
            InstallationState::Suspended
        }
    }
}

/// Queries for installation records; callers enforce policy.
#[unimock::unimock(api = GitHubInstallationsMock)]
pub trait GitHubInstallations {
    /// Read by opaque cloud ID.
    fn github_installation(&mut self, id: InstallationId) -> Result<Option<Installation>>;
    /// Read by stable provider ID.
    fn github_installation_by_provider(&mut self, id: i64) -> Result<Option<Installation>>;
    /// List installations bound to an organization.
    fn github_installations(&mut self, organization: OrganizationId) -> Result<Vec<Installation>>;
    /// Insert or update a known installation.
    fn save_github_installation(&mut self, value: &Installation) -> Result<()>;
}
