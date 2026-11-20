//! Distinct typed fixture identities and a deterministic command context.

use chrono::{DateTime, Utc};
use mkc_billing::entitlements::{DatabaseEntitlements, Entitlements};
use mkc_domain::ids::{InstallationId, MemberId, OrganizationId, ProjectId, RepositoryId, UserId};
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_repository::Repository;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::member::Member;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::user::User;
use uuid::Uuid;

use crate::action::Action;
use crate::pagination::Pagination;
use crate::platform::execution::Execution;

pub(super) const USER: UserId = UserId(Uuid::from_u128(1));
pub(super) const WORKSPACE: OrganizationId = OrganizationId(Uuid::from_u128(2));
pub(super) const MEMBER: MemberId = MemberId(Uuid::from_u128(3));
pub(super) const PROJECT: ProjectId = ProjectId(Uuid::from_u128(4));
pub(super) const REPOSITORY: RepositoryId = RepositoryId(Uuid::from_u128(5));
pub(super) const INSTALLATION: InstallationId = InstallationId(Uuid::from_u128(6));

static ENTITLEMENTS: DatabaseEntitlements = DatabaseEntitlements;

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

pub(super) fn member(role: Role) -> Member {
    Member {
        id: MEMBER,
        organization_id: WORKSPACE,
        user_id: Some(USER),
        email: "person@example.com".into(),
        role,
        version: 1,
        expires_at: None,
    }
}

pub(super) fn user() -> User {
    User {
        id: USER,
        email: "person@example.com".into(),
        name: "Person".into(),
        created_at: now(),
    }
}

pub(super) fn workspace() -> Organization {
    Organization {
        id: WORKSPACE,
        name: "Team".into(),
        slug: "team".parse().unwrap(),
        version: 1,
        created_at: now(),
        plan: Plan::Free,
    }
}

pub(super) fn project() -> Project {
    Project {
        id: PROJECT,
        organization_id: WORKSPACE,
        name: "Project".into(),
        slug: "project".parse().unwrap(),
        repository: "mokly-ai/mokly".into(),
        config_path: "mokly.config.json".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    }
}

pub(super) fn repository() -> Repository {
    Repository {
        id: REPOSITORY,
        installation_id: INSTALLATION,
        github_id: 1_296_269,
        full_name: "mokly-ai/Mokly".into(),
        default_branch: "main".into(),
        private: false,
        active: true,
    }
}

pub(super) fn installation() -> Installation {
    Installation {
        id: INSTALLATION,
        github_id: 1,
        app_id: 123,
        organization_id: Some(WORKSPACE),
        account_id: 583_231,
        account_name: "mokly-ai".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now(),
    }
}

pub(super) fn execution(action: &Action) -> Execution<'_> {
    execution_with_entitlements(action, &ENTITLEMENTS)
}

pub(super) fn execution_with_entitlements<'a>(
    action: &'a Action,
    entitlements: &'a dyn Entitlements,
) -> Execution<'a> {
    Execution {
        builds_configured: false,
        actor: Some(USER),
        action,
        page: Pagination {
            cursor: None,
            limit: 50,
        },
        id: Uuid::from_u128(10),
        second_id: Uuid::from_u128(11),
        now: now(),
        entitlements,
        token_secret: None,
        app_origin: "https://app.example.com",
        canceled_subscription: None,
        preview_workspace: None,
    }
}
