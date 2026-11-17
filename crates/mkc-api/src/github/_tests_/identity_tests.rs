//! Verified-primary-email linking and immutable GitHub account ownership.

use mkc_domain::ids::UserId;
use mkc_store_interface::github_identity::{GitHubIdentitiesMock, GitHubIdentity};
use mkc_store_interface::integration::{IntegrationSubject, IntegrationsMock};
use mkc_store_interface::user::UsersMock;
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::ApiError;
use crate::github::identity::{VerifiedIdentityCommand, VerifiedUser};
use crate::github_error::GitHubError;

use super::support::{USER, github_user, identity, now, user};

fn writes() -> impl Clause {
    (
        GitHubIdentitiesMock::save_github_identity
            .some_call(matching!(_))
            .answers(&|_, link| {
                assert_eq!(link.github_user_id, 1);
                assert_eq!(link.user_id, USER);
                Ok(())
            }),
        IntegrationsMock::save_integration
            .some_call(matching!(IntegrationSubject::User(USER), "octocat", _))
            .returns(Ok(())),
    )
}

fn link() -> GitHubIdentity {
    GitHubIdentity {
        github_user_id: 1,
        user_id: USER,
        login: "previous-login".into(),
        created_at: now(),
    }
}

#[test]
fn first_github_login_links_to_the_existing_magic_link_user() {
    let mut queries = Unimock::new((
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(None)),
        UsersMock::find_user
            .some_call(matching!("octocat@example.com"))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(None)),
        writes(),
    ));
    let account = github_user();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "octocat@example.com",
        actor: None,
        new_id: Uuid::from_u128(99).into(),
        now: now(),
    };
    assert_eq!(command.resolve(&mut queries).unwrap().id, USER);
}

#[test]
fn returning_stable_id_does_not_move_accounts_when_email_changes() {
    let mut queries = Unimock::new((
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(Some(link()))),
        UsersMock::user
            .some_call(matching!(&USER))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(Some(link()))),
        writes(),
    ));
    let account = github_user();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "changed@example.com",
        actor: None,
        new_id: Uuid::from_u128(99).into(),
        now: now(),
    };
    let user = command.resolve(&mut queries).unwrap();
    assert_eq!(user.id, USER);
    assert_eq!(user.email, "octocat@example.com");
}

#[test]
fn connecting_cannot_steal_another_users_github_identity() {
    let mut other = link();
    other.user_id = UserId(Uuid::from_u128(99));
    let mut queries = Unimock::new(
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(Some(other))),
    );
    let account = github_user();
    let actor = identity();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "octocat@example.com",
        actor: Some(&actor),
        new_id: USER,
        now: now(),
    };
    assert!(matches!(
        command.resolve(&mut queries),
        Err(ApiError::GitHub(GitHubError::IdentityConflict))
    ));
}

#[test]
fn connecting_a_new_identity_keeps_the_authenticated_account_with_a_different_email() {
    let mut queries = Unimock::new((
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(None)),
        UsersMock::user
            .some_call(matching!(&USER))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(None)),
        writes(),
    ));
    let account = github_user();
    let actor = identity();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "another@example.com",
        actor: Some(&actor),
        new_id: USER,
        now: now(),
    };
    let connected = command.resolve(&mut queries).unwrap();
    assert_eq!(connected.id, actor.user.id);
    assert_eq!(connected.email, actor.user.email);
}

#[test]
fn one_cloud_user_cannot_silently_replace_an_existing_github_identity() {
    let mut other = link();
    other.github_user_id = 99;
    let mut queries = Unimock::new((
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(None)),
        UsersMock::find_user
            .some_call(matching!("octocat@example.com"))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(Some(other))),
    ));
    let account = github_user();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "octocat@example.com",
        actor: None,
        new_id: USER,
        now: now(),
    };
    assert!(matches!(
        command.resolve(&mut queries),
        Err(ApiError::GitHub(GitHubError::IdentityConflict))
    ));
}

#[test]
fn connecting_with_a_different_email_cannot_replace_an_existing_identity() {
    let mut other = link();
    other.github_user_id = 99;
    let mut queries = Unimock::new((
        GitHubIdentitiesMock::github_identity
            .some_call(matching!(1))
            .returns(Ok(None)),
        UsersMock::user
            .some_call(matching!(&USER))
            .returns(Ok(Some(user()))),
        GitHubIdentitiesMock::user_github_identity
            .some_call(matching!(&USER))
            .returns(Ok(Some(other))),
    ));
    let account = github_user();
    let actor = identity();
    let command: &dyn VerifiedIdentityCommand = &VerifiedUser {
        github: &account,
        email: "personal@example.com",
        actor: Some(&actor),
        new_id: USER,
        now: now(),
    };
    assert!(matches!(
        command.resolve(&mut queries),
        Err(ApiError::GitHub(GitHubError::IdentityConflict))
    ));
}
