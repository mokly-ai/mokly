//! Project defaults and visibility gates through the injected entitlement seam.

use std::sync::Arc;

use mkc_billing::entitlements::DatabaseEntitlements;
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::grant::GrantsMock;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::{Project, ProjectsMock};
use rpc_error::RpcError;
use unimock::{Clause, MockFn, Unimock, matching};

use crate::action::Action;
use crate::error::ApiError;
use crate::input::{CreateProject, UpdateProject};
use crate::payload::Payload;
use crate::platform::execution::Command;
use crate::project_input::InstalledProject;

use super::query_fixture::queries_with_plan;
use super::support::{
    PROJECT, REPOSITORY, WORKSPACE, execution_with_entitlements, member, project, workspace,
};

#[test]
fn project_creation_uses_each_plans_default_visibility() {
    for (plan, visibility) in [
        (Plan::Free, Visibility::Public),
        (Plan::Team, Visibility::Private),
    ] {
        let action = Action::CreateProject(
            WORKSPACE,
            CreateProject::Installed(InstalledProject {
                repository_id: REPOSITORY.0,
                name: "Catalogue".into(),
                slug: "catalogue".parse().unwrap(),
                config_path: "mokly.config.json".into(),
            }),
        );
        let reply = execution_with_entitlements(&action, &DatabaseEntitlements)
            .execute(&mut queries_with_plan(Some(Role::Owner), &action, plan))
            .unwrap();
        let Payload::Project(created) = reply.payload else {
            panic!("project response");
        };
        assert_eq!(created.visibility, visibility);
    }
}

#[test]
fn free_plan_private_transition_returns_typed_precondition_data() {
    let action = update(Visibility::Private);
    let error = execution_with_entitlements(&action, &DatabaseEntitlements)
        .execute(&mut update_queries_with_plan(
            Visibility::Public,
            false,
            Plan::Free,
        ))
        .unwrap_err();
    let rpc = RpcError::from(ApiError::from(error));
    assert_eq!(rpc.reason(), "plan-required");
    let data = rpc.output().error.data.unwrap();
    assert_eq!(data["requiredPlan"], "team");
    assert_eq!(data["feature"], "private-projects");
}

#[test]
fn team_plan_allows_a_private_transition() {
    let action = update(Visibility::Private);
    let reply = execution_with_entitlements(&action, &DatabaseEntitlements)
        .execute(&mut update_queries_with_plan(
            Visibility::Public,
            true,
            Plan::Team,
        ))
        .unwrap();
    let Payload::Project(updated) = reply.payload else {
        panic!("project response");
    };
    assert_eq!(updated.visibility, Visibility::Private);
}

#[test]
fn non_private_transitions_and_downgraded_private_projects_do_not_consult_plan() {
    for (current, requested) in [
        (Visibility::Public, Visibility::Public),
        (Visibility::Private, Visibility::Public),
        (Visibility::Private, Visibility::Private),
    ] {
        let action = update(requested);
        let entitlements = Unimock::new(());
        let reply = execution_with_entitlements(&action, &entitlements)
            .execute(&mut update_queries(current, true))
            .unwrap();
        let Payload::Project(updated) = reply.payload else {
            panic!("project response");
        };
        assert_eq!(updated.visibility, requested);
    }
}

fn update(visibility: Visibility) -> Action {
    Action::UpdateProject(
        PROJECT,
        UpdateProject {
            automatic_builds: None,
            name: "Updated".into(),
            slug: "project".parse().unwrap(),
            visibility,
            require_approval: false,
            version: 1,
        },
    )
}

fn update_queries(visibility: Visibility, saves: bool) -> Unimock {
    let base = (
        update_base(visibility),
        OrganizationsMock::organization
            .each_call(matching!(&WORKSPACE))
            .answers(&|_, _| Ok(Some(workspace()))),
    );
    if saves {
        Unimock::new((
            base,
            ProjectsMock::save_project
                .next_call(matching!((project,) if saved(project)))
                .returns(Ok(())),
        ))
    } else {
        Unimock::new(base)
    }
}

fn update_queries_with_plan(visibility: Visibility, saves: bool, plan: Plan) -> Unimock {
    let base = (
        update_base(visibility),
        OrganizationsMock::organization
            .each_call(matching!(&WORKSPACE))
            .answers_arc(Arc::new(move |_, _| {
                let mut workspace = workspace();
                workspace.plan = plan;
                Ok(Some(workspace))
            })),
    );
    if saves {
        Unimock::new((
            base,
            ProjectsMock::save_project
                .next_call(matching!((project,) if saved(project)))
                .returns(Ok(())),
        ))
    } else {
        Unimock::new(base)
    }
}

fn update_base(visibility: Visibility) -> impl Clause {
    let mut existing = project();
    existing.visibility = visibility;
    (
        ProjectsMock::project
            .next_call(matching!(&PROJECT))
            .returns(Ok(Some(existing))),
        MembersMock::members
            .next_call(matching!(&WORKSPACE))
            .returns(Ok(vec![member(Role::Owner)])),
        GrantsMock::grants
            .next_call(matching!(&PROJECT))
            .returns(Ok(vec![])),
    )
}

fn saved(project: &Project) -> bool {
    project.name == "Updated" && project.version == 2
}
