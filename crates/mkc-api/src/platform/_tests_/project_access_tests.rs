//! Effective project access combines inherited and direct grants without escalation.

use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::grant::{Grant, GrantsMock};
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::token::TokensMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::input::{Delete, UpdateProject};
use crate::platform::error::Error;
use crate::platform::execution::Command;

use super::support::{PROJECT, USER, WORKSPACE, execution, member, project, user};

#[test]
fn direct_grants_are_additive_and_never_grant_workspace_access() {
    let cases = [
        (Some(Role::Owner), Some(Role::Reviewer), Some(Role::Admin)),
        (Some(Role::Member), Some(Role::Admin), Some(Role::Admin)),
        (None, Some(Role::Reviewer), Some(Role::Reviewer)),
        (None, None, None),
    ];
    for (inherited, direct, expected) in cases {
        let mut queries = Unimock::new((
            ProjectsMock::project
                .next_call(matching!(_))
                .returns(Ok(Some(project()))),
            MembersMock::members
                .next_call(matching!(_))
                .returns(Ok(inherited.map(member).into_iter().collect())),
            GrantsMock::grants.next_call(matching!(_)).returns(Ok(direct
                .map(|role| Grant {
                    id: Uuid::from_u128(31).into(),
                    project_id: PROJECT,
                    user_id: USER,
                    role,
                    version: 1,
                })
                .into_iter()
                .collect())),
        ));
        let action = Action::Project(PROJECT);
        let command = execution(&action);
        let result = command.project_access(&mut queries, PROJECT);
        if let Some(role) = expected {
            assert_eq!(result.unwrap().1, Some(role));
        } else {
            assert!(matches!(result, Err(Error::NotFound)));
        }
    }
    let mut queries = Unimock::new(
        MembersMock::members
            .next_call(matching!(_))
            .returns(Ok(vec![])),
    );
    assert!(matches!(
        execution(&Action::Workspace(WORKSPACE)).workspace_role(&mut queries, WORKSPACE),
        Err(Error::NotFound)
    ));
}

#[test]
fn grant_only_admin_reaches_project_administration_but_not_workspace_reads() {
    for action in [
        Action::Tokens(PROJECT),
        Action::Grants(PROJECT),
        Action::UpdateProject(
            PROJECT,
            UpdateProject {
                automatic_builds: None,
                name: "Changed".into(),
                slug: "changed".parse().unwrap(),
                visibility: Visibility::Private,
                require_approval: false,
                version: 1,
            },
        ),
        Action::DeleteProject(
            PROJECT,
            Delete {
                confirmation_name: "Project".into(),
                version: 1,
            },
        ),
        Action::Workspace(WORKSPACE),
        Action::Members(WORKSPACE),
        Action::Projects(WORKSPACE),
    ] {
        if matches!(
            action,
            Action::Workspace(_) | Action::Members(_) | Action::Projects(_)
        ) {
            let mut queries = Unimock::new(
                MembersMock::members
                    .next_call(matching!(_))
                    .returns(Ok(vec![])),
            );
            assert!(
                matches!(
                    execution(&action).execute(&mut queries),
                    Err(Error::NotFound)
                ),
                "{action:?}"
            );
            continue;
        }
        let base = (
            MembersMock::members
                .each_call(matching!(_))
                .answers(&|_, _| Ok(vec![])),
            ProjectsMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Some(project()))),
            GrantsMock::grants.each_call(matching!(_)).answers(&|_, _| {
                Ok(vec![Grant {
                    id: Uuid::from_u128(31).into(),
                    project_id: PROJECT,
                    user_id: USER,
                    role: Role::Admin,
                    version: 1,
                }])
            }),
        );
        let mut queries = match &action {
            Action::Tokens(_) => Unimock::new((
                base,
                TokensMock::tokens
                    .next_call(matching!(_))
                    .returns(Ok(vec![])),
            )),
            Action::Grants(_) => Unimock::new((
                base,
                UsersMock::user
                    .next_call(matching!((id,) if *id == USER))
                    .returns(Ok(Some(user()))),
            )),
            Action::UpdateProject(..) => Unimock::new((
                base,
                ProjectsMock::save_project
                    .next_call(
                        matching!((project,) if project.name == "Changed" && project.slug.as_str() == "changed" && project.version == 2),
                    )
                    .returns(Ok(())),
                OrganizationsMock::organization
                    .next_call(matching!(_))
                    .returns(Ok(Some(super::support::workspace()))),
            )),
            Action::DeleteProject(..) => Unimock::new((
                base,
                ProjectsMock::delete_project
                    .next_call(matching!((id,) if *id == PROJECT))
                    .returns(Ok(())),
            )),
            _ => Unimock::new(base),
        };
        let result = execution(&action).execute(&mut queries);
        assert!(result.is_ok(), "{action:?}: {result:?}");
    }
}
