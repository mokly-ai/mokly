//! Installation ownership proof and repository-list authorization boundaries.

use std::sync::Arc;

use mkc_domain::values::Role;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_github_interface::identity::{IdentitiesMock, Membership, MembershipRole, MembershipState};
use mkc_github_interface::repositories::{AccountKind, Installation, RepositoriesMock};
use mkc_store_interface::github_installation;
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::github_repository::{GitHubRepositoriesMock, Repository};
use mkc_store_interface::github_state;
use mkc_store_interface::member::MembersMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::ApiError;
use crate::github::service::GitHubIntegration;

use super::support::{
    INSTALLATION, REPOSITORY, USER, WORKSPACE, github_user, member, now, pure, read_service,
};

fn provider() -> Installation {
    Installation {
        id: 1,
        app_id: 123,
        account: github_user(),
        html_url: "https://github.com/settings/installations/1".into(),
        suspended_at: None,
    }
}

fn installation() -> github_installation::Installation {
    github_installation::Installation {
        id: INSTALLATION,
        github_id: 1,
        app_id: 123,
        organization_id: Some(WORKSPACE),
        account_id: 1,
        account_name: "octocat".into(),
        account_kind: github_state::AccountKind::User,
        manage_url: "https://github.com/settings/installations/1".into(),
        active: true,
        connected: true,
        updated_at: now(),
    }
}

#[test]
fn a_guessed_installation_id_does_not_prove_access() {
    let mut service = pure();
    service.identities = Arc::new(Unimock::new(
        IdentitiesMock::installations
            .some_call(matching!(_))
            .returns(Ok(Vec::new())),
    ));
    assert!(matches!(
        service.installation_proof(&Secret::new("user-token".into()), &github_user(), 1),
        Err(ApiError::PermissionDenied)
    ));
}

#[test]
fn personal_installations_require_the_same_stable_github_user_id() {
    let mut current = provider();
    current.account.id = 99;
    let mut service = pure();
    service.identities = Arc::new(Unimock::new(
        IdentitiesMock::installations
            .some_call(matching!(_))
            .returns(Ok(vec![current.clone()])),
    ));
    service.repositories = Arc::new(Unimock::new(
        RepositoriesMock::installation
            .some_call(matching!(1))
            .returns(Ok(current)),
    ));
    assert!(matches!(
        service.installation_proof(&Secret::new("user-token".into()), &github_user(), 1),
        Err(ApiError::PermissionDenied)
    ));
}

#[test]
fn ordinary_and_pending_github_org_members_cannot_bind_installations() {
    for (role, state) in [
        (MembershipRole::Member, MembershipState::Active),
        (MembershipRole::Admin, MembershipState::Pending),
    ] {
        let mut current = provider();
        current.account.kind = AccountKind::Organization;
        current.account.login = "octo-org".into();
        let mut service = pure();
        service.identities = Arc::new(Unimock::new((
            IdentitiesMock::installations
                .some_call(matching!(_))
                .returns(Ok(vec![current.clone()])),
            IdentitiesMock::membership
                .some_call(matching!(_, "octo-org"))
                .returns(Ok(Membership { role, state })),
        )));
        service.repositories = Arc::new(Unimock::new(
            RepositoriesMock::installation
                .some_call(matching!(1))
                .returns(Ok(current)),
        ));
        assert!(matches!(
            service.installation_proof(&Secret::new("user-token".into()), &github_user(), 1),
            Err(ApiError::PermissionDenied)
        ));
    }
}

#[test]
fn personal_owner_proof_fetches_the_current_installation_repository_set() {
    let mut service = pure();
    service.identities = Arc::new(Unimock::new(
        IdentitiesMock::installations
            .some_call(matching!(_))
            .returns(Ok(vec![provider()])),
    ));
    service.repositories = Arc::new(Unimock::new((
        RepositoriesMock::installation
            .some_call(matching!(1))
            .returns(Ok(provider())),
        RepositoriesMock::repositories
            .some_call(matching!(1))
            .returns(Ok(Vec::new())),
    )));
    service.tokens = Arc::new(Unimock::new(
        TokensMock::invalidate
            .some_call(matching!(1))
            .returns(Ok(())),
    ));
    assert!(
        service
            .installation_proof(&Secret::new("user-token".into()), &github_user(), 1)
            .is_ok()
    );
}

#[test]
fn repository_lists_filter_inactive_rows_and_require_local_membership() {
    let active = Repository {
        id: REPOSITORY,
        installation_id: INSTALLATION,
        github_id: 1296269,
        full_name: "octocat/Hello-World".into(),
        default_branch: "master".into(),
        private: false,
        active: true,
    };
    let mut inactive = active.clone();
    inactive.active = false;
    let service = read_service(Unimock::new((
        GitHubInstallationsMock::github_installation
            .some_call(matching!(&INSTALLATION))
            .returns(Ok(Some(installation()))),
        MembersMock::members
            .some_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Reviewer)])),
        GitHubRepositoriesMock::github_repositories
            .some_call(matching!(&INSTALLATION))
            .returns(Ok(vec![active, inactive])),
    )));
    let results = service.repositories(USER, INSTALLATION).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, REPOSITORY);
}

#[test]
fn inaccessible_and_disconnected_installations_do_not_list_private_repositories() {
    for connected in [true, false] {
        let mut installation = installation();
        installation.connected = connected;
        let members = if connected {
            Vec::new()
        } else {
            vec![member(Role::Owner)]
        };
        let service = read_service(Unimock::new((
            GitHubInstallationsMock::github_installation
                .some_call(matching!(&INSTALLATION))
                .returns(Ok(Some(installation))),
            MembersMock::members
                .some_call(matching!(&WORKSPACE))
                .returns(Ok(members)),
        )));
        assert!(matches!(
            service.repositories(USER, INSTALLATION),
            Err(ApiError::NotFound)
        ));
    }
}

#[test]
fn enterprise_and_bot_installation_owners_are_rejected_by_policy() {
    for kind in [AccountKind::Enterprise, AccountKind::Bot] {
        let mut current = provider();
        current.account.kind = kind;
        let mut service = pure();
        service.identities = Arc::new(Unimock::new(
            IdentitiesMock::installations
                .some_call(matching!(_))
                .returns(Ok(vec![current.clone()])),
        ));
        service.repositories = Arc::new(Unimock::new(
            RepositoriesMock::installation
                .some_call(matching!(1))
                .returns(Ok(current)),
        ));
        assert!(matches!(
            service.installation_proof(&Secret::new("user-token".into()), &github_user(), 1),
            Err(ApiError::PermissionDenied)
        ));
    }
}
