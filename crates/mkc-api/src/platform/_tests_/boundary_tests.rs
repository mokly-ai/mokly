//! Last-owner, verified-email binding and parent-scoped identifiers.

use chrono::Duration;
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::grant::{Grant, GrantsMock};
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::token::{Token, TokensMock};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::input::{Rename, RoleUpdate, Version};
use crate::payload::Payload;
use crate::platform::error::Error;
use crate::platform::execution::Command;

use super::support::{MEMBER, PROJECT, USER, WORKSPACE, execution, member, now, project, user};

#[test]
fn last_owner_cannot_be_demoted_or_removed() {
    for action in [
        Action::UpdateMember(
            WORKSPACE,
            MEMBER,
            RoleUpdate {
                role: Role::Admin,
                version: 1,
            },
        ),
        Action::RemoveMember(WORKSPACE, MEMBER, Version { version: 1 }),
    ] {
        let mut queries = Unimock::new((
            MembersMock::members
                .each_call(matching!(_))
                .answers(&|_, _| Ok(vec![member(Role::Owner)])),
            MembersMock::member
                .next_call(matching!(_))
                .returns(Ok(Some(member(Role::Owner)))),
        ));
        assert!(matches!(
            execution(&action).execute(&mut queries),
            Err(Error::LastOwner)
        ));
    }
}

#[test]
fn a_sole_owner_can_change_the_workspace_slug() {
    let action = Action::RenameWorkspace(
        WORKSPACE,
        Rename {
            name: "Team".into(),
            slug: "changed".parse().unwrap(),
            version: 1,
        },
    );
    let mut queries = Unimock::new((
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![member(Role::Owner)])),
        OrganizationsMock::organization
            .next_call(matching!(_))
            .returns(Ok(Some(super::support::workspace()))),
        OrganizationsMock::save_organization
            .next_call(matching!((workspace,) if workspace.slug.as_str() == "changed" && workspace.version == 2))
            .returns(Ok(())),
        GitHubInstallationsMock::github_installations
            .next_call(matching!(_))
            .returns(Ok(vec![])),
    ));
    let Payload::Workspace(workspace) = execution(&action).execute(&mut queries).unwrap().payload
    else {
        panic!("workspace response")
    };
    assert_eq!(workspace.slug.as_str(), "changed");
}

#[test]
fn invitation_acceptance_is_bound_to_verified_email() {
    for matches_email in [false, true] {
        let mut invited = member(Role::Member);
        invited.user_id = None;
        invited.expires_at = Some(now() + Duration::days(1));
        if !matches_email {
            invited.email = "someone-else@example.com".into();
        }
        let base = (
            UsersMock::user
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Some(user()))),
            MembersMock::member
                .next_call(matching!(_))
                .returns(Ok(Some(invited))),
        );
        let mut queries = if matches_email {
            Unimock::new((base, MembersMock::save_member.next_call(matching!((m,) if m.user_id == Some(USER) && m.expires_at.is_none() && m.version == 2)).returns(Ok(()))))
        } else {
            Unimock::new(base)
        };
        let result = execution(&Action::Accept(WORKSPACE, MEMBER)).execute(&mut queries);
        if matches_email {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::NotFound)));
        }
    }
}

#[test]
fn member_ids_from_another_workspace_are_not_found() {
    for action in [
        Action::UpdateMember(
            WORKSPACE,
            MEMBER,
            RoleUpdate {
                role: Role::Reviewer,
                version: 1,
            },
        ),
        Action::RemoveMember(WORKSPACE, MEMBER, Version { version: 1 }),
        Action::Accept(WORKSPACE, MEMBER),
    ] {
        let mut foreign = member(Role::Member);
        foreign.organization_id = Uuid::from_u128(99).into();
        let lookup = MembersMock::member
            .next_call(matching!(_))
            .returns(Ok(Some(foreign)));
        let mut queries = if matches!(action, Action::Accept(..)) {
            Unimock::new((
                UsersMock::user
                    .next_call(matching!(_))
                    .returns(Ok(Some(user()))),
                lookup,
            ))
        } else {
            Unimock::new((
                MembersMock::members
                    .next_call(matching!(_))
                    .returns(Ok(vec![member(Role::Owner)])),
                lookup,
            ))
        };
        assert!(matches!(
            execution(&action).execute(&mut queries),
            Err(Error::NotFound)
        ));
    }
}

#[test]
fn grant_and_token_ids_from_another_project_are_not_found() {
    let id = Uuid::from_u128(21);
    for action in [
        Action::UpdateGrant(
            PROJECT,
            id.into(),
            RoleUpdate {
                role: Role::Reviewer,
                version: 1,
            },
        ),
        Action::RemoveGrant(PROJECT, id.into(), Version { version: 1 }),
        Action::RevokeToken(PROJECT, id.into()),
    ] {
        let base = (
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(project()))),
            MembersMock::members
                .next_call(matching!(_))
                .returns(Ok(vec![member(Role::Owner)])),
            GrantsMock::grants
                .next_call(matching!(_))
                .returns(Ok(vec![])),
        );
        let mut queries = if matches!(action, Action::RevokeToken(..)) {
            Unimock::new((
                base,
                TokensMock::token
                    .next_call(matching!(_))
                    .returns(Ok(Some(Token {
                        id: id.into(),
                        project_id: Uuid::from_u128(99).into(),
                        name: "Token".into(),
                        prefix: "mkc_fixture".into(),
                        token_hash: "0".repeat(64),
                        created_at: now(),
                        last_used_at: None,
                        revoked_at: None,
                    }))),
            ))
        } else {
            Unimock::new((
                base,
                GrantsMock::grant
                    .next_call(matching!(_))
                    .returns(Ok(Some(Grant {
                        id: id.into(),
                        project_id: Uuid::from_u128(99).into(),
                        user_id: USER,
                        role: Role::Member,
                        version: 1,
                    }))),
            ))
        };
        assert!(matches!(
            execution(&action).execute(&mut queries),
            Err(Error::NotFound)
        ));
    }
}

#[test]
fn anonymous_read_is_allowed_only_for_public_projects() {
    for visibility in [Visibility::Public, Visibility::Private] {
        let mut project = project();
        project.visibility = visibility;
        let project_lookup = ProjectsMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(project)));
        let mut queries = if visibility == Visibility::Public {
            Unimock::new((
                project_lookup,
                OrganizationsMock::organization
                    .next_call(matching!(_))
                    .returns(Ok(Some(super::support::workspace()))),
            ))
        } else {
            Unimock::new(project_lookup)
        };
        let action = Action::Project(PROJECT);
        let mut command = execution(&action);
        command.actor = None;
        let result = command.execute(&mut queries);
        if visibility == Visibility::Public {
            let Payload::Project(view) = result.unwrap().payload else {
                panic!("project response");
            };
            assert!(!view.can_admin);
        } else {
            assert!(matches!(result, Err(Error::NotFound)));
        }
    }
}
