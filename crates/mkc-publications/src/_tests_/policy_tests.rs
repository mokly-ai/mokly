//! Token scope, revocation and current catalogue memberships.

use mkc_domain::ids::{GrantId, MemberId, ProjectId};
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::grant::{Grant, GrantsMock};
use mkc_store_interface::member::{Member, MembersMock};
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::token::TokensMock;
use mkc_store_interface::user::{User, UsersMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::policy::{AccessPolicy, DatabaseAccessPolicy};

use super::support::{PROJECT, USER, now, organization, project, token};

#[test]
fn missing_revoked_and_other_project_tokens_are_distinct() {
    let mut queries = Unimock::new(
        TokensMock::token_by_hash
            .next_call(matching!("digest"))
            .returns(Ok(None)),
    );
    assert!(matches!(
        DatabaseAccessPolicy.token(&mut queries, PROJECT, "digest"),
        Err(Error::Unauthorized)
    ));
    let mut revoked = token();
    revoked.revoked_at = Some(now());
    let mut queries = Unimock::new(
        TokensMock::token_by_hash
            .next_call(matching!(_))
            .returns(Ok(Some(revoked))),
    );
    assert!(matches!(
        DatabaseAccessPolicy.token(&mut queries, PROJECT, "digest"),
        Err(Error::Unauthorized)
    ));
    let mut queries = Unimock::new(
        TokensMock::token_by_hash
            .next_call(matching!(_))
            .returns(Ok(Some(token()))),
    );
    assert!(matches!(
        DatabaseAccessPolicy.token(&mut queries, ProjectId(Uuid::from_u128(90)), "digest"),
        Err(Error::Forbidden)
    ));
}

#[test]
fn upload_policy_enforces_the_private_project_plan_gate() {
    for (plan, visibility, allowed) in [
        (Plan::Free, Visibility::Private, false),
        (Plan::Free, Visibility::Public, true),
        (Plan::Team, Visibility::Private, true),
    ] {
        let mut value = project();
        value.visibility = visibility;
        let mut queries = Unimock::new((
            TokensMock::token_by_hash
                .next_call(matching!("digest"))
                .returns(Ok(Some(token()))),
            ProjectsMock::project
                .next_call(matching!(&PROJECT))
                .returns(Ok(Some(value))),
            OrganizationsMock::organization
                .next_call(matching!(_))
                .returns(Ok(Some(organization(plan)))),
        ));
        let result = DatabaseAccessPolicy.token(&mut queries, PROJECT, "digest");
        if allowed {
            assert!(result.is_ok(), "{plan:?} {visibility:?}: {result:?}");
        } else {
            assert!(matches!(result, Err(Error::PlanRequired)));
        }
    }
}

#[test]
fn public_projects_allow_anonymous_reads_and_private_projects_require_identity() {
    for visibility in [Visibility::Private, Visibility::Public] {
        let mut value = project();
        value.visibility = visibility;
        let mut queries = Unimock::new(
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(value))),
        );
        let result = DatabaseAccessPolicy.read(&mut queries, PROJECT, None);
        if visibility == Visibility::Public {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::Unauthorized)));
        }
    }
}

#[test]
fn downgraded_private_projects_keep_existing_member_reads() {
    let mut queries = Unimock::new((
        ProjectsMock::project
            .next_call(matching!(&PROJECT))
            .returns(Ok(Some(project()))),
        UsersMock::user
            .next_call(matching!(&USER))
            .returns(Ok(Some(User {
                id: USER,
                email: "u@example.com".into(),
                name: "User".into(),
                created_at: now(),
            }))),
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![Member {
                id: MemberId(Uuid::from_u128(20)),
                organization_id: project().organization_id,
                user_id: Some(USER),
                email: "u@example.com".into(),
                role: Role::Member,
                version: 1,
                expires_at: None,
            }])),
        GrantsMock::grants
            .next_call(matching!(&PROJECT))
            .returns(Ok(vec![])),
    ));
    assert!(
        DatabaseAccessPolicy
            .read(&mut queries, PROJECT, Some(USER))
            .is_ok()
    );
}

#[test]
fn every_active_inherited_or_direct_role_can_read_and_removed_users_cannot() {
    for role in [Role::Owner, Role::Admin, Role::Member, Role::Reviewer] {
        for inherited in [true, false] {
            let members = if inherited {
                vec![Member {
                    id: MemberId(Uuid::from_u128(20)),
                    organization_id: project().organization_id,
                    user_id: Some(USER),
                    email: "u@example.com".into(),
                    role,
                    version: 1,
                    expires_at: None,
                }]
            } else {
                vec![]
            };
            let grants = if inherited {
                vec![]
            } else {
                vec![Grant {
                    id: GrantId(Uuid::from_u128(21)),
                    project_id: PROJECT,
                    user_id: USER,
                    role,
                    version: 1,
                }]
            };
            let mut queries = Unimock::new((
                ProjectsMock::project
                    .next_call(matching!(_))
                    .returns(Ok(Some(project()))),
                UsersMock::user
                    .next_call(matching!(_))
                    .returns(Ok(Some(User {
                        id: USER,
                        email: "u@example.com".into(),
                        name: "User".into(),
                        created_at: now(),
                    }))),
                MembersMock::members
                    .next_call(matching!(_))
                    .returns(Ok(members)),
                GrantsMock::grants
                    .next_call(matching!(_))
                    .returns(Ok(grants)),
            ));
            assert!(
                DatabaseAccessPolicy
                    .read(&mut queries, PROJECT, Some(USER))
                    .is_ok()
            );
        }
    }
    let mut queries = Unimock::new((
        ProjectsMock::project
            .next_call(matching!(_))
            .returns(Ok(Some(project()))),
        UsersMock::user.next_call(matching!(_)).returns(Ok(None)),
    ));
    assert!(matches!(
        DatabaseAccessPolicy.read(&mut queries, PROJECT, Some(USER)),
        Err(Error::Unauthorized)
    ));
}
