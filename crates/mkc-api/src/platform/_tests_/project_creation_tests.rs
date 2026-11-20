//! Installed repository projects require current access to their workspace binding.

use std::collections::HashMap;
use std::sync::Arc;

use mkc_domain::values::Role;
use mkc_store_interface::github_installation::{GitHubInstallationsMock, Installation};
use mkc_store_interface::github_repository::{GitHubRepositoriesMock, Repository};
use mkc_store_interface::grant::GrantsMock;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::project::ProjectsMock;
use rpc_error::RpcError;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::endpoints;
use crate::error::ApiError;
use crate::input::CreateProject;
use crate::operation::Operation;
use crate::payload::Payload;
use crate::platform::error::Error;
use crate::platform::execution::Command;
use crate::project_input::InstalledProject;

use super::support::{
    REPOSITORY, WORKSPACE, execution, installation, member, repository, workspace,
};

fn create() -> Action {
    Action::CreateProject(
        WORKSPACE,
        CreateProject::Installed(InstalledProject {
            repository_id: REPOSITORY.0,
            name: "Project".into(),
            slug: "project".parse().unwrap(),
            config_path: "mokly.config.json".into(),
        }),
    )
}

/// Persistence is permissive; only the installation checks decide these outcomes.
fn queries(repository: Repository, installation: Installation) -> Unimock {
    Unimock::new((
        MembersMock::members
            .each_call(matching!(_))
            .answers(&|_, _| Ok(vec![member(Role::Owner)]))
            .at_least_times(0),
        OrganizationsMock::organization
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(workspace())))
            .at_least_times(0),
        ProjectsMock::projects
            .each_call(matching!(_))
            .answers(&|_, _| Ok(vec![]))
            .at_least_times(0),
        ProjectsMock::insert_project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .at_least_times(0),
        GrantsMock::insert_grant
            .each_call(matching!(_))
            .answers(&|_, _| Ok(()))
            .at_least_times(0),
        GitHubRepositoriesMock::link_github_project
            .each_call(matching!(_))
            .answers(&|_, _, _| Ok(()))
            .at_least_times(0),
        (
            GitHubRepositoriesMock::github_repository
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(Some(repository.clone()))))
                .at_least_times(0),
            GitHubInstallationsMock::github_installation
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(Some(installation.clone()))))
                .at_least_times(0),
        ),
    ))
    .no_verify_in_drop()
}

fn refused(repository: Repository, installation: Installation) -> Error {
    let action = create();
    match execution(&action).execute(&mut queries(repository, installation)) {
        Err(error) => error,
        Ok(reply) => panic!("creation must be refused: {:?}", reply.payload),
    }
}

#[test]
fn a_body_that_names_no_installed_repository_is_validation_failed() {
    let params: HashMap<_, _> = [("workspaceId".to_owned(), WORKSPACE.0.to_string())]
        .into_iter()
        .collect();
    for bytes in [
        br#"{"name":"Project","slug":"project","configPath":"mokly.config.json"}"#.as_slice(),
        br#"{"name":"Project","slug":"project","repository":"mokly-ai/mokly","repositoryId":"00000000-0000-0000-0000-000000000001","configPath":"mokly.config.json"}"#,
        br#"{"name":"Project","slug":"project","repositoryId":null,"configPath":"mokly.config.json"}"#,
        br#"{"name":"Project","slug":"project","repositoryId":"mokly-ai/mokly","configPath":"mokly.config.json"}"#,
    ] {
        let result = endpoints::action(Operation::CreateProject, &params, bytes, "");
        assert!(matches!(result, Err(Error::InvalidInput)), "{result:?}");
    }
    assert_eq!(
        RpcError::from(ApiError::from(Error::InvalidInput)).reason(),
        "validation-failed"
    );
}

#[test]
fn the_stored_repository_name_comes_from_the_installed_record() {
    let action = create();
    let reply = execution(&action)
        .execute(&mut queries(repository(), installation()))
        .unwrap();
    let Payload::Project(project) = reply.payload else {
        panic!("project creation must answer with a project");
    };
    assert_eq!(project.repository, "mokly-ai/Mokly");
}

#[test]
fn an_installation_owned_by_another_workspace_is_not_found() {
    let mut foreign = installation();
    foreign.organization_id = Some(Uuid::from_u128(99).into());
    assert!(matches!(refused(repository(), foreign), Error::NotFound));
}

#[test]
fn a_disconnected_suspended_or_deselected_repository_is_not_found() {
    let mut disconnected = installation();
    disconnected.connected = false;
    let mut suspended = installation();
    suspended.active = false;
    let mut deselected = repository();
    deselected.active = false;
    for error in [
        refused(repository(), disconnected),
        refused(repository(), suspended),
        refused(deselected, installation()),
    ] {
        assert!(matches!(error, Error::NotFound), "{error:?}");
    }
}
