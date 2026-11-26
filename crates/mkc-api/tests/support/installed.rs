//! An installation and one repository seeded in the store: the state a
//! completed GitHub installation leaves, for scenarios that do not walk it.

use chrono::Utc;
use mkc_domain::ids::{InstallationId, OrganizationId, RepositoryId};
use mkc_store_interface::error::Result;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::store::Queries;
use uuid::Uuid;

/// A provider identifier no recording or other seed uses.
fn provider_id() -> i64 {
    i64::try_from(Uuid::now_v7().as_u128() % (1 << 62)).unwrap() + 2
}

/// Bind a fresh active installation holding `full_name` to `workspace`. Each
/// store error returns to the caller's transaction, which retries a
/// serialization failure.
pub(crate) fn seed_installed_repository(
    queries: &mut dyn Queries,
    workspace: OrganizationId,
    full_name: &str,
) -> Result<RepositoryId> {
    let owner = full_name.split('/').next().unwrap();
    let installation = Installation {
        id: InstallationId(Uuid::now_v7()),
        github_id: provider_id(),
        app_id: 123,
        organization_id: Some(workspace),
        account_id: provider_id(),
        account_name: owner.into(),
        account_kind: AccountKind::Organization,
        manage_url: format!("https://github.com/organizations/{owner}/settings/installations/1"),
        active: true,
        connected: true,
        updated_at: Utc::now(),
    };
    queries.save_github_installation(&installation)?;
    let repository = Repository {
        id: RepositoryId(Uuid::now_v7()),
        installation_id: installation.id,
        github_id: provider_id(),
        full_name: full_name.into(),
        default_branch: "main".into(),
        private: false,
        active: true,
    };
    queries.save_github_repository(&repository)?;
    Ok(repository.id)
}
