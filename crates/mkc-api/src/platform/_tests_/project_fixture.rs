//! Permissive project persistence for full command-dispatch coverage.

use std::sync::Arc;

use mkc_domain::values::Role;
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::github_repository::GitHubRepositoriesMock;
use mkc_store_interface::grant::{Grant, GrantsMock};
use mkc_store_interface::project::{ProjectLookup, ProjectsMock};
use mkc_store_interface::token::{Token, TokensMock};
use unimock::{Clause, MockFn, matching};
use uuid::Uuid;

use crate::action::Action;

use super::support::{PROJECT, installation, now, project, repository};

pub(super) fn queries(action: &Action) -> impl Clause {
    let projects = if matches!(action, Action::CreateProject(..)) {
        vec![]
    } else {
        vec![project()]
    };
    (
        (
            ProjectsMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Some(project())))
                .at_least_times(0),
            ProjectsMock::find_project_by_slug
                .each_call(matching!(_, _))
                .answers(&|_, _, _| {
                    Ok(Some(ProjectLookup {
                        value: project(),
                        retired: false,
                    }))
                })
                .at_least_times(0),
            ProjectsMock::project_slug_claimed
                .each_call(matching!(_, _))
                .answers(&|_, _, _| Ok(false))
                .at_least_times(0),
            ProjectsMock::projects
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(projects.clone())))
                .at_least_times(0),
            ProjectsMock::insert_project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            ProjectsMock::save_project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            ProjectsMock::delete_project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
        ),
        (
            GrantsMock::grants
                .each_call(matching!(_))
                .answers(&|_, _| Ok(vec![]))
                .at_least_times(0),
            GrantsMock::grant
                .each_call(matching!(_))
                .answers(&|_, id| {
                    Ok(Some(Grant {
                        id,
                        project_id: PROJECT,
                        user_id: Uuid::from_u128(21).into(),
                        role: Role::Member,
                        version: 1,
                    }))
                })
                .at_least_times(0),
            GrantsMock::insert_grant
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            GrantsMock::save_grant
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            GrantsMock::delete_grant
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
        ),
        (
            TokensMock::tokens
                .each_call(matching!(_))
                .answers(&|_, _| Ok(vec![]))
                .at_least_times(0),
            TokensMock::token
                .each_call(matching!(_))
                .answers(&|_, id| {
                    Ok(Some(Token {
                        id,
                        project_id: PROJECT,
                        name: "Token".into(),
                        prefix: "mkc_12345678".into(),
                        token_hash: "0".repeat(64),
                        created_at: now(),
                        last_used_at: None,
                        revoked_at: None,
                    }))
                })
                .at_least_times(0),
            TokensMock::insert_token
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            TokensMock::save_token
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
        ),
        (
            GitHubRepositoriesMock::github_repository
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Some(repository())))
                .at_least_times(0),
            GitHubRepositoriesMock::link_github_project
                .each_call(matching!(_))
                .answers(&|_, _, _| Ok(()))
                .at_least_times(0),
            GitHubInstallationsMock::github_installation
                .each_call(matching!(_))
                .answers(&|_, _| Ok(Some(installation())))
                .at_least_times(0),
        ),
    )
}
